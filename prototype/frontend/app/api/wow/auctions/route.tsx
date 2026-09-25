import { NextResponse } from 'next/server'

export async function GET() {
  const clientId = process.env.BLIZZARD_CLIENT_ID
  const clientSecret = process.env.BLIZZARD_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 500 })
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch('https://oauth.battle.net/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  const data = await res.json()
  return NextResponse.json({ access_token: data.access_token })
}