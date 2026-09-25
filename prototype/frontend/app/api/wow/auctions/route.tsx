'use client'

import { useEffect, useState } from 'react'

type Auction = {
  id: number
  item: { id: number }
  buyout: number
  quantity: number
  time_left: string
}

export default function AuctionHousePage() {
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/wow/auctions?realmId=509') // ← your connected realm ID
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch')
        return res.json()
      })
      .then((data) => setAuctions(data.auctions || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p>Loading auctions…</p>
  if (error) return <p>Error: {error}</p>

  return (
    <div>
      <h1>WoW Auction House</h1>
      <p>{auctions.length} auctions found</p>
      <ul>
        {auctions.slice(0, 50).map((a) => (
          <li key={a.id}>
            Item #{a.item.id} — {a.quantity}x — {a.buyout} gold — {a.time_left}
          </li>
        ))}
      </ul>
    </div>
  )
}