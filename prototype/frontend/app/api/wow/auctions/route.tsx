import { NextRequest, NextResponse } from 'next/server'

type BlizzardTokenResponse = {
  access_token: string
  token_type: string
  expires_in: number
}

type BlizzardRealm = {
  id: number
  name: string
  slug: string
}

type BlizzardConnectedRealm = {
  id: number
  realms: BlizzardRealm[]
}

type BlizzardConnectedRealmIndex = {
  connected_realms: {
    href: string
  }[]
}

async function getAccessToken(
  clientId: string,
  clientSecret: string
) {
  const credentials = Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString('base64')

  const response = await fetch(
    'https://oauth.battle.net/token',
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type':
          'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      cache: 'no-store',
    }
  )

  const text = await response.text()

  if (!response.ok) {
    throw new Error(
      `Blizzard OAuth failed (${response.status}): ${text}`
    )
  }

  const data =
    JSON.parse(text) as BlizzardTokenResponse

  if (!data.access_token) {
    throw new Error(
      'Blizzard OAuth did not return an access token'
    )
  }

  return data.access_token
}

export async function GET(
  request: NextRequest
) {
  try {
    const clientId =
      process.env.BLIZZARD_CLIENT_ID

    const clientSecret =
      process.env.BLIZZARD_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        {
          error:
            'Missing BLIZZARD_CLIENT_ID or BLIZZARD_CLIENT_SECRET',
        },
        { status: 500 }
      )
    }

    const searchParams =
      request.nextUrl.searchParams

    const region =
      searchParams.get('region') || 'eu'

    const realmId =
      searchParams.get('realmId')

    if (
      region !== 'eu' &&
      region !== 'us'
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid region. Use eu or us.',
        },
        { status: 400 }
      )
    }

    const locale =
      region === 'eu'
        ? 'en_GB'
        : 'en_US'

    const namespace =
      `dynamic-${region}`

    /*
     * Get Blizzard OAuth token
     */
    const accessToken =
      await getAccessToken(
        clientId,
        clientSecret
      )

    /*
     * =========================================
     * REALM LIST
     * =========================================
     *
     * /api/wow/auctions?region=eu
     */
    if (!realmId) {
      const indexUrl =
        `https://${region}.api.blizzard.com/data/wow/connected-realm/index` +
        `?namespace=${namespace}` +
        `&locale=${locale}`

      console.log(
        'Fetching connected realm index:',
        indexUrl
      )

      const indexResponse =
        await fetch(indexUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: 'no-store',
        })

      const indexText =
        await indexResponse.text()

      console.log(
        'Connected realm index status:',
        indexResponse.status
      )

      if (!indexResponse.ok) {
        throw new Error(
          `Blizzard connected realm index failed (${indexResponse.status}): ${indexText}`
        )
      }

      const indexData =
        JSON.parse(
          indexText
        ) as BlizzardConnectedRealmIndex

      console.log(
        'Connected realms found:',
        indexData.connected_realms?.length
      )

      if (
        !indexData.connected_realms ||
        !Array.isArray(
          indexData.connected_realms
        )
      ) {
        throw new Error(
          'Blizzard did not return connected_realms'
        )
      }

      /*
       * Blizzard returns URLs such as:
       *
       * https://eu.api.blizzard.com/data/wow/connected-realm/509
       *
       * Fetch each connected realm.
       */
      const realmResults =
        await Promise.all(
          indexData.connected_realms.map(
            async (connectedRealm) => {
              try {
                const url =
                  new URL(
                    connectedRealm.href
                  )

                url.searchParams.set(
                  'namespace',
                  namespace
                )

                url.searchParams.set(
                  'locale',
                  locale
                )

                const response =
                  await fetch(
                    url.toString(),
                    {
                      headers: {
                        Authorization: `Bearer ${accessToken}`,
                      },
                      cache: 'no-store',
                    }
                  )

                const text =
                  await response.text()

                if (!response.ok) {
                  console.error(
                    'Connected realm failed:',
                    connectedRealm.href,
                    response.status,
                    text
                  )

                  return null
                }

                const data =
                  JSON.parse(
                    text
                  ) as BlizzardConnectedRealm

                return data
              } catch (error) {
                console.error(
                  'Failed to fetch connected realm:',
                  connectedRealm.href,
                  error
                )

                return null
              }
            }
          )
        )

      /*
       * Flatten all realms.
       *
       * Multiple realms can belong to the
       * same connected realm, so they all use
       * the connected realm ID for auctions.
       */
      const realms = realmResults
        .filter(
          (
            realm
          ): realm is BlizzardConnectedRealm =>
            realm !== null
        )
        .flatMap(
          (connectedRealm) =>
            connectedRealm.realms.map(
              (realm) => ({
                id: connectedRealm.id,
                name: realm.name,
                slug: realm.slug,
              })
            )
        )
        .sort(
          (a, b) =>
            a.name.localeCompare(
              b.name
            )
        )

      console.log(
        'Final realms:',
        realms.length
      )

      return NextResponse.json({
        region,
        realms,
      })
    }

    /*
     * =========================================
     * AUCTIONS
     * =========================================
     *
     * /api/wow/auctions?region=eu&realmId=509
     */
    const auctionsUrl =
      `https://${region}.api.blizzard.com/data/wow/connected-realm/${realmId}/auctions` +
      `?namespace=${namespace}` +
      `&locale=${locale}`

    console.log(
      'Fetching auctions:',
      auctionsUrl
    )

    const auctionsResponse =
      await fetch(auctionsUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      })

    const auctionsText =
      await auctionsResponse.text()

    if (!auctionsResponse.ok) {
      throw new Error(
        `Blizzard auctions request failed (${auctionsResponse.status}): ${auctionsText}`
      )
    }

    const auctionsData =
      JSON.parse(auctionsText)

    return NextResponse.json(
      auctionsData
    )
  } catch (error) {
    console.error(
      'WoW API error:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Blizzard API error',
      },
      { status: 500 }
    )
  }
}