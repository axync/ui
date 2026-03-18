'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { api, EnrichedListing } from '@/services/api'
import { formatAmount } from '@/utils/transactions'

type Filter = 'all' | 'sablier' | 'hedgey' | 'other'

export default function Marketplace() {
  const [listings, setListings] = useState<EnrichedListing[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')

  const loadListings = useCallback(async () => {
    try {
      const data = await api.getListings()
      setListings(data.listings)
    } catch (err) {
      console.error('Failed to load listings:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadListings()
  }, [loadListings])

  const filtered = listings.filter((l) => {
    if (filter === 'all') return true
    if (filter === 'other') return !l.platform
    return l.platform === filter
  })

  function getPlatformIcon(listing: EnrichedListing) {
    if (listing.platform === 'sablier') return { letter: 'S', bg: 'bg-amber/10 text-amber' }
    if (listing.platform === 'hedgey') return { letter: 'H', bg: 'bg-green/10 text-green' }
    if (listing.nft_symbol) return { letter: listing.nft_symbol.charAt(0).toUpperCase(), bg: 'bg-ice/10 text-ice' }
    return { letter: 'N', bg: 'bg-bg4 text-tx3' }
  }

  function getCollectionName(listing: EnrichedListing): string {
    if (listing.platform) return listing.platform.charAt(0).toUpperCase() + listing.platform.slice(1)
    if (listing.nft_name) return listing.nft_name
    return listing.nft_contract.slice(0, 10) + '...'
  }

  return (
    <div className="space-y-6 fi">
      <div className="flex items-end justify-between fi1">
        <div>
          <h1 className="text-2xl font-bold text-tx">NFT Marketplace</h1>
          <p className="text-tx3 text-sm mt-1">Trade vesting positions and NFTs trustlessly. No issuer approval needed.</p>
        </div>
        <Link href="/list" className="btn btn-primary">
          Sell NFT
        </Link>
      </div>

      <div className="flex items-center gap-2 fi2">
        {(['all', 'sablier', 'hedgey', 'other'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filter === f
                ? 'bg-lav/10 text-lav border border-lav/20'
                : 'text-tx3 hover:text-tx hover:bg-bg3 border border-transparent'
            }`}
          >
            {f === 'all' ? 'All' : f === 'other' ? 'Other NFTs' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <span className="text-tx3 text-sm ml-auto">{filtered.length} listings</span>
      </div>

      {loading ? (
        <div className="card p-12 text-center text-tx3">Loading listings...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-tx2 text-lg font-medium">No listings yet</p>
          <p className="text-tx3 text-sm mt-2">Be the first to list an NFT</p>
          <Link href="/list" className="btn btn-primary mt-4 inline-block">
            List NFT
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 fi3">
          {filtered.map((listing) => {
            const isEth = listing.payment_token === '0x0000000000000000000000000000000000000000'
            const icon = getPlatformIcon(listing)
            const name = getCollectionName(listing)

            return (
              <Link key={listing.id} href={`/listing/${listing.id}`} className="card hover:border-lav/30 transition-all group">
                <div className="p-5 flex items-center gap-6">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${icon.bg}`}>
                    {icon.letter}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-tx font-medium">{name} #{listing.token_id}</span>
                      {listing.platform && (
                        <span className="badge-lav">{listing.platform}</span>
                      )}
                      {!listing.platform && listing.nft_symbol && (
                        <span className="badge-ice">{listing.nft_symbol}</span>
                      )}
                    </div>
                    <div className="text-tx3 text-sm mt-0.5">
                      Listed by {listing.seller.slice(0, 6)}...{listing.seller.slice(-4)}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-tx font-semibold">
                      {formatAmount(BigInt(listing.price))} {isEth ? 'ETH' : 'USDC'}
                    </div>
                  </div>

                  <div className="text-tx3 group-hover:text-lav transition-colors">&rarr;</div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
