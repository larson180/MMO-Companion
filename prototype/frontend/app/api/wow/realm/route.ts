import { NextRequest, NextResponse } from 'next/server'

type BlizzardTokenResponse = {
  access_token?: string
}

export async function GET(
  request: NextRequest
) {
  try {
    const realmId =
      request.nextUrl.searchParams.get(
        'realmId'
      )

    const region =
      request.nextUrl.searchParams.get(
        'region'
      ) || 'eu'

    /*
     * Validate region
     */
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

    /*
     * Validate realm ID
     */
    if (!realmId) {
      return NextResponse.json(
        {
          error: 'Missing realmId',
        },
        { status: 400 }
      )
    }

    /*
     * Blizzard credentials
     */
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
            'Missing Blizzard credentials',
        },
        { status: 500 }
      )
    }

    /*
     * Get Blizzard access token
     */
    const auth = Buffer.from(
      `${clientId}:${clientSecret}`
    ).toString('base64')

    const tokenRes = await fetch(
      'https://oauth.battle.net/token',
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type':
            'application/x-www-form-urlencoded',
        },
        body:
          'grant_type=client_credentials',
        cache: 'no-store',
      }
    )

    const tokenText =
      await tokenRes.text()

    console.log(
      'Blizzard token status:',
      tokenRes.status
    )

    if (!tokenRes.ok) {
      console.error(
        'Blizzard token response:',
        tokenText
      )

      return NextResponse.json(
        {
          error:
            'Blizzard authentication failed',
          status: tokenRes.status,
          details:
            tokenText ||
            'Empty response',
        },
        { status: tokenRes.status }
      )
    }

    if (!tokenText.trim()) {
      return NextResponse.json(
        {
          error:
            'Blizzard authentication returned an empty response',
        },
        { status: 502 }
      )
    }

    let tokenData: BlizzardTokenResponse

    try {
      tokenData =
        JSON.parse(tokenText)
    } catch {
      return NextResponse.json(
        {
          error:
            'Blizzard authentication returned invalid JSON',
          details: tokenText,
        },
        { status: 502 }
      )
    }

    if (
      !tokenData.access_token
    ) {
      return NextResponse.json(
        {
          error:
            'Blizzard authentication response did not contain an access token',
        },
        { status: 502 }
      )
    }

    /*
     * EU = en_GB
     * US = en_US
     */
    const locale =
      region === 'eu'
        ? 'en_GB'
        : 'en_US'

    /*
     * Get auctions for the selected
     * connected realm.
     */
    const auctionUrl =
      `https://${region}.api.blizzard.com` +
      `/data/wow/connected-realm/` +
      `${realmId}/auctions` +
      `?namespace=dynamic-${region}` +
      `&locale=${locale}`

    console.log(
      'Auction URL:',
      auctionUrl
    )

    const auctionRes =
      await fetch(auctionUrl, {
        headers: {
          Authorization:
            `Bearer ${tokenData.access_token}`,
        },
        cache: 'no-store',
      })

    const auctionText =
      await auctionRes.text()

    console.log(
      'Blizzard auction status:',
      auctionRes.status
    )

    if (!auctionRes.ok) {
      console.error(
        'Blizzard auction response:',
        auctionText
      )

      return NextResponse.json(
        {
          error:
            'Blizzard auction API failed',
          status: auctionRes.status,
          details:
            auctionText ||
            'Empty response',
        },
        {
          status:
            auctionRes.status,
        }
      )
    }

    if (!auctionText.trim()) {
      return NextResponse.json(
        {
          error:
            'Blizzard auction API returned an empty response',
        },
        { status: 502 }
      )
    }

    let auctionData

    try {
      auctionData =
        JSON.parse(auctionText)
    } catch {
      return NextResponse.json(
        {
          error:
            'Blizzard auction API returned invalid JSON',
          details: auctionText,
        },
        { status: 502 }
      )
    }

    return NextResponse.json(
      auctionData
    )
  } catch (error) {
    console.error(
      'Auction route error:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error',
      },
      { status: 500 }
    )
  }
}