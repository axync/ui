'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, Listing, VestingPosition } from '@/services/api'
import { formatAmount } from '@/utils/transactions'

interface ListingWithVesting extends Listing {
  vesting?: VestingPosition | null
}

export default function Marketplace() {
  const [listings, setListings] = useState<ListingWithVesting[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'sablier' | 'hedgey'>('all')

  useEffect(() => {
    loadListings()
  }, [])

  async function loadListings() {
    try {
      const data = await api.getListings()
      const enriched = await Promise.all(
        data.listings.map(async (listing) => {
          try {
            const detail = await api.getListingDetail(listing.id)
            return { ...listing, vesting: detail.vesting }
          } catch {
            return { ...listing, vesting: null }
          }
        })
      )
      setListings(enriched)
    } catch (err) {
      console.error('Failed to load listings:', err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = listings.filter((l) => {
    if (filter === 'all') return true
    return l.vesting?.platform === filter
  })

  function calcDiscount(listing: ListingWithVesting): string | null {
    if (!listing.vesting) return null
    const total = BigInt(listing.vesting.total_amount)
    const price = BigInt(listing.price)
    if (total === 0n) return null
    const discount = ((total - price) * 100n) / total
    return discount.toString()
  }

  function formatTime(ts: number): string {
    if (!ts) return '—'
    return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="space-y-6 fi">
      <div className="flex items-end justify-between fi1">
        <div>
          <h1 className="text-2xl font-bold text-tx">Vesting Marketplace</h1>
          <p className="text-tx3 text-sm mt-1">Trade locked token positions trustlessly. No issuer approval needed.</p>
        </div>
        <Link href="/list" className="btn btn-primary">
          Sell Position
        </Link>
      </div>

      <div className="flex items-center gap-2 fi2">
        {(['all', 'sablier', 'hedgey'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filter === f
                ? 'bg-lav/10 text-lav border border-lav/20'
                : 'text-tx3 hover:text-tx hover:bg-bg3 border border-transparent'
            }`}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <span className="text-tx3 text-sm ml-auto">{filtered.length} listings</span>
      </div>

      {loading ? (
        <div className="card p-12 text-center text-tx3">Loading listings...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-tx2 text-lg font-medium">No listings yet</p>
          <p className="text-tx3 text-sm mt-2">Be the first to list a vesting position</p>
          <Link href="/list" className="btn btn-primary mt-4 inline-block">
            List Position
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 fi3">
          {filtered.map((listing) => {
            const discount = calcDiscount(listing)
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
                      {listing.vesting && (
                        <span className={`badge-${listing.vesting.status === 'Streaming' ? 'green' : listing.vesting.status === 'Settled' ? 'lav' : 'muted'}`}>
                          {listing.vesting.status}
                        </span>
                      )}
                      {listing.vesting?.is_transferable && (
                        <span className="badge-ice">Transferable</span>
                      )}
                    </div>
                    <div className="text-tx3 text-sm mt-0.5">
                      {listing.vesting ? (
                        <>
                          {formatAmount(BigInt(listing.vesting.total_amount))} tokens · {formatTime(listing.vesting.start_time)} → {formatTime(listing.vesting.end_time)}
                        </>
                      ) : (
                        <>NFT #{listing.token_id} on {listing.nft_contract.slice(0, 10)}...</>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-tx font-semibold">
                      {formatAmount(BigInt(listing.price))} {isEth ? 'ETH' : 'USDC'}
                    </div>
                    {discount && (
                      <div className="text-green text-sm font-medium">{discount}% discount</div>
                    )}
                  </div>

                  <div className="text-tx3 group-hover:text-lav transition-colors">→</div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
