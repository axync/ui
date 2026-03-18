'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useWallet } from '@/hooks/useWallet'
import { api, Listing, VestingPosition } from '@/services/api'
import { formatAmount, formatAddress } from '@/utils/transactions'

interface ListingWithVesting extends Listing {
  vesting?: VestingPosition | null
}

type Tab = 'listings' | 'purchased'

export default function Portfolio() {
  const { address } = useWallet()
  const [tab, setTab] = useState<Tab>('listings')
  const [myListings, setMyListings] = useState<ListingWithVesting[]>([])
  const [positions, setPositions] = useState<VestingPosition[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (address) loadPortfolio()
  }, [address])

  async function loadPortfolio() {
    setLoading(true)
    try {
      const [listingsData, vestingData] = await Promise.all([
        api.getListings(),
        api.getVestingPositions(address!),
      ])

      // Filter listings by current user
      const mine = listingsData.listings.filter(
        (l) => l.seller.toLowerCase() === address!.toLowerCase()
      )

      // Enrich with vesting data
      const enriched = await Promise.all(
        mine.map(async (listing) => {
          try {
            const detail = await api.getListingDetail(listing.id)
            return { ...listing, vesting: detail.vesting }
          } catch {
            return { ...listing, vesting: null }
          }
        })
      )

      setMyListings(enriched)
      setPositions(vestingData.positions || [])
    } catch (err) {
      console.error('Failed to load portfolio:', err)
    } finally {
      setLoading(false)
    }
  }

  function formatTime(ts: number): string {
    if (!ts) return '—'
    return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (!address) {
    return (
      <div className="card p-12 text-center fi">
        <p className="text-tx2 text-lg font-medium">Connect your wallet</p>
        <p className="text-tx3 text-sm mt-2">View your listings and vesting positions</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 fi">
      <div className="fi1">
        <h1 className="text-2xl font-bold text-tx">Portfolio</h1>
        <p className="text-tx3 text-sm mt-1">Your listings and vesting positions</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 fi2">
        {([
          { key: 'listings' as Tab, label: 'My Listings', count: myListings.length },
          { key: 'purchased' as Tab, label: 'Vesting Positions', count: positions.length },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-lav/10 text-lav border border-lav/20'
                : 'text-tx3 hover:text-tx hover:bg-bg3 border border-transparent'
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-xs opacity-60">{t.count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-12 text-center text-tx3">Loading portfolio...</div>
      ) : tab === 'listings' ? (
        /* My Listings */
        myListings.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-tx2 text-lg font-medium">No active listings</p>
            <p className="text-tx3 text-sm mt-2">List a vesting position to start selling</p>
            <Link href="/list" className="btn btn-primary mt-4 inline-block">
              Sell Position
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 fi3">
            {myListings.map((listing) => {
              const isEth = listing.payment_token === '0x0000000000000000000000000000000000000000'
              return (
                <Link key={listing.id} href={`/listing/${listing.id}`} className="card hover:border-lav/30 transition-all group">
                  <div className="p-5 flex items-center gap-6">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                      listing.vesting?.platform === 'sablier'
                        ? 'bg-amber/10 text-amber'
                        : listing.vesting?.platform === 'hedgey'
                        ? 'bg-green/10 text-green'
                        : 'bg-bg4 text-tx3'
                    }`}>
                      {listing.vesting?.platform === 'sablier' ? 'S' : listing.vesting?.platform === 'hedgey' ? 'H' : '?'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-tx font-medium">#{listing.token_id}</span>
                        <span className={`badge-${listing.active ? 'green' : 'muted'}`}>
                          {listing.active ? 'Active' : 'Sold'}
                        </span>
                        {listing.vesting && (
                          <span className={`badge-${listing.vesting.status === 'Streaming' ? 'green' : listing.vesting.status === 'Settled' ? 'lav' : 'muted'}`}>
                            {listing.vesting.status}
                          </span>
                        )}
                      </div>
                      <div className="text-tx3 text-sm mt-0.5">
                        {listing.vesting ? (
                          <>
                            {formatAmount(BigInt(listing.vesting.total_amount))} tokens · {formatTime(listing.vesting.start_time)} → {formatTime(listing.vesting.end_time)}
                          </>
                        ) : (
                          <>NFT #{listing.token_id} on {formatAddress(listing.nft_contract)}</>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-tx font-semibold">
                        {formatAmount(BigInt(listing.price))} {isEth ? 'ETH' : 'USDC'}
                      </div>
                    </div>

                    <div className="text-tx3 group-hover:text-lav transition-colors">→</div>
                  </div>
                </Link>
              )
            })}
          </div>
        )
      ) : (
        /* Vesting Positions */
        positions.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-tx2 text-lg font-medium">No vesting positions found</p>
            <p className="text-tx3 text-sm mt-2">Sablier and Hedgey positions will appear here</p>
          </div>
        ) : (
          <div className="grid gap-4 fi3">
            {positions.map((pos) => {
              const progress = (() => {
                if (!pos.start_time || !pos.end_time) return 0
                const now = Math.floor(Date.now() / 1000)
                const total = pos.end_time - pos.start_time
                if (total <= 0) return 100
                const elapsed = now - pos.start_time
                return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)))
              })()

              return (
                <div key={`${pos.contract}-${pos.token_id}`} className="card p-5">
                  <div className="flex items-center gap-6">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                      pos.platform === 'sablier' ? 'bg-amber/10 text-amber' : 'bg-green/10 text-green'
                    }`}>
                      {pos.platform === 'sablier' ? 'S' : 'H'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-tx font-medium">
                          {pos.platform.charAt(0).toUpperCase() + pos.platform.slice(1)} #{pos.token_id}
                        </span>
                        <span className={`badge-${pos.status === 'Streaming' ? 'green' : pos.status === 'Settled' ? 'lav' : 'muted'}`}>
                          {pos.status}
                        </span>
                        {pos.is_transferable && <span className="badge-ice">Transferable</span>}
                      </div>
                      <div className="text-tx3 text-sm mt-0.5">
                        {formatAmount(BigInt(pos.total_amount))} tokens · {formatTime(pos.start_time)} → {formatTime(pos.end_time)}
                      </div>

                      {/* Progress bar */}
                      <div className="mt-2 flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-bg4 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-lav to-ice rounded-full" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-tx3 text-xs">{progress}%</span>
                      </div>
                    </div>

                    <div className="text-right">
                      {pos.withdrawable_amount !== '0' && (
                        <div className="text-green text-sm font-medium">
                          {formatAmount(BigInt(pos.withdrawable_amount))} claimable
                        </div>
                      )}
                      {pos.is_transferable && (
                        <Link href="/list" className="text-lav text-xs hover:underline mt-1 inline-block">
                          Sell →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
