'use client'

import { useEffect, useState } from 'react'
import Navbar from '../../../components/Navbar'
import {
  games,
  type Game,
} from '../../../types/games'

type Region = 'eu' | 'us'

type Realm = {
  id: number
  name: string
  slug: string
}

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
  const wowGame =
    games.find(
      (game) => game.id === 'wow'
    ) || games[0]

  const [
    selectedGame,
    setSelectedGame,
  ] = useState<Game>(wowGame)

  const [
    region,
    setRegion,
  ] = useState<Region>('eu')

  const [
    realms,
    setRealms,
  ] = useState<Realm[]>([])

  const [
    selectedRealmId,
    setSelectedRealmId,
  ] = useState<number | null>(null)

  const [
    auctions,
    setAuctions,
  ] = useState<Auction[]>([])

  const [
    loadingRealms,
    setLoadingRealms,
  ] = useState(true)

  const [
    loadingAuctions,
    setLoadingAuctions,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState<string | null>(null)

  const [
    currentPage,
    setCurrentPage,
  ] = useState(1)

  /*
   * Load realms whenever the region changes.
   */
  useEffect(() => {
  const loadRealms = async () => {
    try {
      setLoadingRealms(true)
      setError(null)

      setRealms([])
      setSelectedRealmId(null)
      setAuctions([])
      setCurrentPage(1)

      const res = await fetch(
        `/api/wow/auctions?region=${region}`,
        {
          cache: 'no-store',
        }
      )

      const text = await res.text()

      console.log('REALM API STATUS:', res.status)
      console.log('REALM API RESPONSE:', text)

      if (!res.ok) {
        throw new Error(
          text ||
            `Failed to fetch realms (${res.status})`
        )
      }

      if (!text.trim()) {
        throw new Error(
          'Realm API returned an empty response'
        )
      }

      const data = JSON.parse(text)

      console.log('REALM DATA:', data)
      console.log('REALMS:', data.realms)

      if (!Array.isArray(data.realms)) {
        throw new Error(
          'Realm API did not return a realms array'
        )
      }

      setRealms(data.realms)

      if (data.realms.length > 0) {
        setSelectedRealmId(data.realms[0].id)
      } else {
        throw new Error(
          `Blizzard returned 0 realms for ${region.toUpperCase()}`
        )
      }
    } catch (err) {
      console.error(
        'FAILED TO LOAD REALMS:',
        err
      )

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to fetch realms'
      )
    } finally {
      setLoadingRealms(false)
    }
  }

  loadRealms()
}, [region])

  /*
   * Load auctions whenever the selected
   * realm changes.
   */
  useEffect(() => {
    if (
      selectedRealmId === null
    ) {
      return
    }

    const loadAuctions =
      async () => {
        try {
          setLoadingAuctions(true)
          setError(null)
          setCurrentPage(1)

          const res = await fetch(
            `/api/wow/auctions?region=${region}&realmId=${selectedRealmId}`,
            {
              cache: 'no-store',
            }
          )

          const text =
            await res.text()

          if (!res.ok) {
            throw new Error(
              text ||
                `Failed to fetch auctions (${res.status})`
            )
          }

          if (!text.trim()) {
            throw new Error(
              'Auction API returned an empty response'
            )
          }

          const data =
            JSON.parse(text)

          setAuctions(
            Array.isArray(
              data.auctions
            )
              ? data.auctions
              : []
          )
        } catch (err) {
          console.error(err)

          setAuctions([])

          setError(
            err instanceof Error
              ? err.message
              : 'Failed to fetch auctions'
          )
        } finally {
          setLoadingAuctions(false)
        }
      }

    loadAuctions()
  }, [
    region,
    selectedRealmId,
  ])

  /*
   * Pagination
   */
  const totalPages =
    Math.ceil(
      auctions.length /
        ITEMS_PER_PAGE
    )

  const startIndex =
    (currentPage - 1) *
    ITEMS_PER_PAGE

  const currentAuctions =
    auctions.slice(
      startIndex,
      startIndex +
        ITEMS_PER_PAGE
    )

  const selectedRealm =
    realms.find(
      (realm) =>
        realm.id ===
        selectedRealmId
    )

  const goToPreviousPage =
    () => {
      setCurrentPage((page) =>
        Math.max(page - 1, 1)
      )
    }

  const goToNextPage =
    () => {
      setCurrentPage((page) =>
        Math.min(
          page + 1,
          totalPages
        )
      )
    }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar
        selectedGame={
          selectedGame
        }
        setSelectedGame={
          setSelectedGame
        }
      />

      <main className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">

          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="mb-2 text-2xl font-bold sm:text-3xl">
              WoW Auction House
            </h1>

            {!loadingAuctions &&
              !error &&
              selectedRealm && (
                <p className="text-sm text-gray-400 sm:text-base">
                  {selectedRealm.name}{' '}
                  ·{' '}
                  {region.toUpperCase()}
                  {' · '}
                  {auctions.length.toLocaleString()}{' '}
                  auctions found
                </p>
              )}
          </div>

          {/* Filters */}
          <div className="mx-auto mb-6 flex w-full max-w-5xl flex-col gap-4 rounded-lg border border-gray-800 bg-gray-900 p-4 sm:flex-row">

            {/* Region */}
            <div className="flex flex-1 flex-col gap-2">
              <label
                htmlFor="region"
                className="text-sm font-medium text-gray-300"
              >
                Region
              </label>

              <select
                id="region"
                value={region}
                onChange={(event) =>
                  setRegion(
                    event.target.value as Region
                  )
                }
                className="rounded-lg border border-gray-700 bg-gray-950 px-4 py-2.5 text-white outline-none transition focus:border-blue-500"
              >
                <option value="eu">
                  Europe
                </option>

                <option value="us">
                  United States
                </option>
              </select>
            </div>

            {/* Realm */}
            <div className="flex flex-1 flex-col gap-2">
              <label
                htmlFor="realm"
                className="text-sm font-medium text-gray-300"
              >
                Realm
              </label>

              <select
                id="realm"
                value={
                  selectedRealmId ??
                  ''
                }
                onChange={(event) =>
                  setSelectedRealmId(
                    Number(
                      event.target.value
                    )
                  )
                }
                disabled={
                  loadingRealms ||
                  realms.length === 0
                }
                className="rounded-lg border border-gray-700 bg-gray-950 px-4 py-2.5 text-white outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loadingRealms ? (
                  <option value="">
                    Loading realms...
                  </option>
                ) : realms.length ===
                  0 ? (
                  <option value="">
                    No realms found
                  </option>
                ) : (
                  realms.map(
                    (realm) => (
                      <option
                        key={`${realm.id}-${realm.slug}`}
                        value={realm.id}
                      >
                        {realm.name}
                      </option>
                    )
                  )
                )}
              </select>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mx-auto mb-6 max-w-5xl rounded-lg border border-red-900 bg-red-900/30 p-4 text-red-200">
              <p className="font-semibold">
                Error
              </p>

              <p className="mt-2 break-words text-sm">
                {error}
              </p>
            </div>
          )}

          {/* Loading auctions */}
          {loadingAuctions && (
            <div className="flex justify-center py-8">
              <p className="text-gray-400">
                Loading auctions...
              </p>
            </div>
          )}

          {/* No auctions */}
          {!loadingRealms &&
            !loadingAuctions &&
            !error &&
            selectedRealmId !==
              null &&
            auctions.length ===
              0 && (
              <div className="mx-auto max-w-5xl rounded-lg border border-gray-800 bg-gray-900 p-8 text-center">
                <p className="text-gray-400">
                  No auctions found for{' '}
                  {selectedRealm?.name ??
                    'this realm'}.
                </p>
              </div>
            )}

          {/* Auction Table */}
          {!loadingAuctions &&
            !error &&
            auctions.length >
              0 && (
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
                        {currentAuctions.map(
                          (auction) => (
                            <tr
                              key={
                                auction.id
                              }
                              className="border-t border-gray-800 hover:bg-gray-900/70"
                            >
                              <td className="p-3 sm:p-4">
                                #
                                {
                                  auction
                                    .item
                                    .id
                                }
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
                                {
                                  auction.time_left
                                }
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination */}
                {totalPages >
                  1 && (
                  <div className="mt-6 flex justify-center">
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={
                          goToPreviousPage
                        }
                        disabled={
                          currentPage ===
                          1
                        }
                        className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40 sm:px-5"
                      >
                        Previous
                      </button>

                      <span className="whitespace-nowrap text-sm text-gray-400 sm:text-base">
                        Page{' '}
                        {currentPage}{' '}
                        of{' '}
                        {totalPages}
                      </span>

                      <button
                        type="button"
                        onClick={
                          goToNextPage
                        }
                        disabled={
                          currentPage ===
                          totalPages
                        }
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