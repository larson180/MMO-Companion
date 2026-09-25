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

type BlizzardAuction = {
  id: number
  item: {
    id: number
  }
  buyout?: number
  quantity: number
  time_left: string
}

type BlizzardItem = {
  id: number
  name?: string
}

type ItemNameCacheEntry = {
  name: string
  expiresAt: number
}

/*
 * --------------------------------------------------
 * ITEM NAME CACHE
 * --------------------------------------------------
 *
 * Keeps item names in server memory for 1 hour.
 */
const itemNameCache =
  new Map<number, ItemNameCacheEntry>()

const ITEM_CACHE_TTL =
  60 * 60 * 1000

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

  const text =
    await response.text()

  if (!response.ok) {
    throw new Error(
      `Blizzard OAuth failed (${response.status}): ${text}`
    )
  }

  const data =
    JSON.parse(
      text
    ) as BlizzardTokenResponse

  if (!data.access_token) {
    throw new Error(
      'Blizzard OAuth did not return an access token'
    )
  }

  return data.access_token
}

/*
 * --------------------------------------------------
 * GET ITEM NAMES
 * --------------------------------------------------
 *
 * Blizzard item endpoints use:
 *
 * static-eu
 * static-us
 *
 * Auction endpoints use:
 *
 * dynamic-eu
 * dynamic-us
 */
async function getItemNames(
  itemIds: number[],
  region: 'eu' | 'us',
  locale: string,
  accessToken: string
) {
  const itemNames: Record<
    number,
    string
  > = {}

  const uniqueItemIds =
    Array.from(
      new Set(itemIds)
    )

  const idsToFetch: number[] = []

  /*
   * Check cache first.
   */
  for (const itemId of uniqueItemIds) {
    const cached =
      itemNameCache.get(itemId)

    if (
      cached &&
      cached.expiresAt >
        Date.now()
    ) {
      itemNames[itemId] =
        cached.name
    } else {
      idsToFetch.push(itemId)
    }
  }

  /*
   * Only make a few Blizzard requests
   * simultaneously.
   */
  const CONCURRENCY = 5

  for (
    let i = 0;
    i < idsToFetch.length;
    i += CONCURRENCY
  ) {
    const batch =
      idsToFetch.slice(
        i,
        i + CONCURRENCY
      )

    const results =
      await Promise.all(
        batch.map(
          async (itemId) => {
            try {
              /*
               * IMPORTANT:
               *
               * Items use the STATIC namespace.
               */
              const url =
                `https://${region}.api.blizzard.com/data/wow/item/${itemId}` +
                `?namespace=static-${region}` +
                `&locale=${locale}`

              console.log(
                'FETCHING ITEM:',
                itemId,
                url
              )

              const response =
                await fetch(
                  url,
                  {
                    headers: {
                      Authorization: `Bearer ${accessToken}`,
                    },
                    cache: 'no-store',
                  }
                )

              const text =
                await response.text()

              console.log(
                'ITEM RESPONSE:',
                itemId,
                response.status,
                text.slice(0, 500)
              )

              if (!response.ok) {
                return {
                  itemId,
                  name: null,
                }
              }

              const data =
                JSON.parse(
                  text
                ) as BlizzardItem

              if (
                !data.name ||
                typeof data.name !==
                  'string'
              ) {
                return {
                  itemId,
                  name: null,
                }
              }

              /*
               * Cache successful lookup.
               */
              itemNameCache.set(
                itemId,
                {
                  name: data.name,
                  expiresAt:
                    Date.now() +
                    ITEM_CACHE_TTL,
                }
              )

              return {
                itemId,
                name: data.name,
              }
            } catch (error) {
              console.error(
                `ITEM ${itemId} LOOKUP ERROR:`,
                error
              )

              return {
                itemId,
                name: null,
              }
            }
          }
        )
      )

    for (const result of results) {
      if (result.name) {
        itemNames[
          result.itemId
        ] = result.name
      }
    }
  }

  return itemNames
}

export async function GET(
  request: NextRequest
) {
  try {
    const clientId =
      process.env.BLIZZARD_CLIENT_ID

    const clientSecret =
      process.env.BLIZZARD_CLIENT_SECRET

    if (
      !clientId ||
      !clientSecret
    ) {
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

    const regionParam =
      searchParams.get(
        'region'
      ) || 'eu'

    if (
      regionParam !== 'eu' &&
      regionParam !== 'us'
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid region. Use eu or us.',
        },
        { status: 400 }
      )
    }

    const region =
      regionParam as 'eu' | 'us'

    const locale =
      region === 'eu'
        ? 'en_GB'
        : 'en_US'

    const realmId =
      searchParams.get(
        'realmId'
      )

    const itemIdsParam =
      searchParams.get(
        'itemIds'
      )

    const dynamicNamespace =
      `dynamic-${region}`

    /*
     * --------------------------------------------------
     * TOKEN
     * --------------------------------------------------
     */

    const accessToken =
      await getAccessToken(
        clientId,
        clientSecret
      )

    /*
     * --------------------------------------------------
     * ITEM NAME LOOKUP
     * --------------------------------------------------
     *
     * Example:
     *
     * /api/wow/auctions?region=eu&itemIds=2770,2447
     */

    if (itemIdsParam) {
      const itemIds =
        itemIdsParam
          .split(',')
          .map((value) =>
            Number(value)
          )
          .filter(
            (value) =>
              Number.isInteger(
                value
              ) &&
              value > 0
          )

      if (itemIds.length === 0) {
        return NextResponse.json(
          {
            error:
              'No valid item IDs supplied',
          },
          { status: 400 }
        )
      }

      if (itemIds.length > 50) {
        return NextResponse.json(
          {
            error:
              'Maximum 50 item IDs per request',
          },
          { status: 400 }
        )
      }

      const itemNames =
        await getItemNames(
          itemIds,
          region,
          locale,
          accessToken
        )

      return NextResponse.json({
        region,
        itemNames,
      })
    }

    /*
     * --------------------------------------------------
     * REALM LIST
     * --------------------------------------------------
     */

    if (!realmId) {
      const indexUrl =
        `https://${region}.api.blizzard.com/data/wow/connected-realm/index` +
        `?namespace=${dynamicNamespace}` +
        `&locale=${locale}`

      console.log(
        'Fetching connected realm index:',
        indexUrl
      )

      const indexResponse =
        await fetch(
          indexUrl,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            cache: 'no-store',
          }
        )

      const indexText =
        await indexResponse.text()

      console.log(
        'Connected realm index status:',
        indexResponse.status
      )

      if (
        !indexResponse.ok
      ) {
        throw new Error(
          `Blizzard connected realm index failed (${indexResponse.status}): ${indexText}`
        )
      }

      const indexData =
        JSON.parse(
          indexText
        ) as BlizzardConnectedRealmIndex

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

      const realmResults =
        await Promise.all(
          indexData.connected_realms.map(
            async (
              connectedRealm
            ) => {
              try {
                const url =
                  new URL(
                    connectedRealm.href
                  )

                url.searchParams.set(
                  'namespace',
                  dynamicNamespace
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

                if (
                  !response.ok
                ) {
                  console.error(
                    'Connected realm failed:',
                    connectedRealm.href,
                    response.status,
                    text
                  )

                  return null
                }

                return JSON.parse(
                  text
                ) as BlizzardConnectedRealm
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

      const realms =
        realmResults
          .filter(
            (
              realm
            ): realm is BlizzardConnectedRealm =>
              realm !== null
          )
          .flatMap(
            (
              connectedRealm
            ) =>
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

      return NextResponse.json({
        region,
        realms,
      })
    }

    /*
     * --------------------------------------------------
     * AUCTIONS
     * --------------------------------------------------
     */

    const auctionsUrl =
      `https://${region}.api.blizzard.com/data/wow/connected-realm/${realmId}/auctions` +
      `?namespace=${dynamicNamespace}` +
      `&locale=${locale}`

    console.log(
      'Fetching auctions:',
      auctionsUrl
    )

    const auctionsResponse =
      await fetch(
        auctionsUrl,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: 'no-store',
        }
      )

    const auctionsText =
      await auctionsResponse.text()

    console.log(
      'Auction response status:',
      auctionsResponse.status
    )

    if (
      !auctionsResponse.ok
    ) {
      throw new Error(
        `Blizzard auctions request failed (${auctionsResponse.status}): ${auctionsText}`
      )
    }

    const auctionsData =
      JSON.parse(
        auctionsText
      )

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