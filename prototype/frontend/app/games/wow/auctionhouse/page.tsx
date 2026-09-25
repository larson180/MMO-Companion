'use client'

import { useEffect, useState } from 'react'
import Navbar from '../../../components/Navbar'
import { games, type Game } from '../../../types/games'

type Auction = {
  id: number
  item: {
    id: number
  }
  buyout?: number
  quantity: number
  time_left: string
}

const ITEMS_PER_PAGE = 20

export default function AuctionHousePage() {
  const wowGame = games.find((game) => game.id === 'wow') || games[0]

  const [selectedGame, setSelectedGame] = useState<Game>(wowGame)
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    const loadAuctions = async () => {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch(
          '/api/wow/auctions?realmId=509',
          {
            cache: 'no-store',
          }
        )

        const text = await res.text()

        if (!res.ok) {
          throw new Error(
            text || `Failed to fetch auctions (${res.status})`
          )
        }

        if (!text.trim()) {
          throw new Error(
            'Auction API returned an empty response'
          )
        }

        const data = JSON.parse(text)

        setAuctions(
          Array.isArray(data.auctions)
            ? data.auctions
            : []
        )
      } catch (err) {
        console.error(err)

        setError(
          err instanceof Error
            ? err.message
            : 'Failed to fetch auctions'
        )
      } finally {
        setLoading(false)
      }
    }

    loadAuctions()
  }, [])

  const totalPages = Math.ceil(
    auctions.length / ITEMS_PER_PAGE
  )

  const startIndex =
    (currentPage - 1) * ITEMS_PER_PAGE

  const currentAuctions = auctions.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  )

  const goToPreviousPage = () => {
    setCurrentPage((page) =>
      Math.max(page - 1, 1)
    )
  }

  const goToNextPage = () => {
    setCurrentPage((page) =>
      Math.min(page + 1, totalPages)
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar
        selectedGame={selectedGame}
        setSelectedGame={setSelectedGame}
      />

      <main className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">

          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="mb-2 text-2xl font-bold sm:text-3xl">
              WoW Auction House
            </h1>

            {!loading && !error && (
              <p className="text-sm text-gray-400 sm:text-base">
                {auctions.length.toLocaleString()} auctions found
              </p>
            )}
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex justify-center">
              <p className="text-gray-400">
                Loading auctions...
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mx-auto max-w-5xl rounded-lg border border-red-900 bg-red-900/30 p-4 text-red-200">
              <p className="font-semibold">
                Error loading auctions
              </p>

              <p className="mt-2 break-words text-sm">
                {error}
              </p>
            </div>
          )}

          {/* Auction Table */}
          {!loading && !error && (
            <>
              <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-lg border border-gray-800 bg-gray-950">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-left">
                    <thead className="bg-gray-900">
                      <tr>
                        <th className="p-3 text-sm font-semibold sm:p-4">
                          Item
                        </th>

                        <th className="p-3 text-sm font-semibold sm:p-4">
                          Quantity
                        </th>

                        <th className="p-3 text-sm font-semibold sm:p-4">
                          Buyout
                        </th>

                        <th className="p-3 text-sm font-semibold sm:p-4">
                          Time Left
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {currentAuctions.map((auction) => (
                        <tr
                          key={auction.id}
                          className="border-t border-gray-800 hover:bg-gray-900/70"
                        >
                          <td className="p-3 sm:p-4">
                            #{auction.item.id}
                          </td>

                          <td className="p-3 sm:p-4">
                            {auction.quantity.toLocaleString()}
                          </td>

                          <td className="p-3 sm:p-4">
                            {auction.buyout
                              ? `${auction.buyout.toLocaleString()} gold`
                              : 'No buyout'}
                          </td>

                          <td className="p-3 sm:p-4">
                            {auction.time_left}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex justify-center">
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={goToPreviousPage}
                      disabled={currentPage === 1}
                      className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40 sm:px-5"
                    >
                      Previous
                    </button>

                    <span className="whitespace-nowrap text-sm text-gray-400 sm:text-base">
                      Page {currentPage} of {totalPages}
                    </span>

                    <button
                      type="button"
                      onClick={goToNextPage}
                      disabled={currentPage === totalPages}
                      className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40 sm:px-5"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}