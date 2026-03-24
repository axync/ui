'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { api, NftListing } from '@/services/api'
import { getContracts } from '@/config/contracts'
import { ethers } from 'ethers'

type Filter = 'all' | 'erc20' | 'nft'

function DealCard({ listing }: { listing: NftListing }) {
  const priceEth = ethers.formatEther(listing.price)
  const assetChain = getContracts(listing.nft_chain_id)?.shortName || '?'
  const paymentChain = getContracts(listing.payment_chain_id)?.shortName || '?'
  const isToken = listing.asset_type === 'ERC20'

  const assetLabel = isToken
    ? `${ethers.formatEther(listing.amount?.toString() || '0')} tokens`
    : `NFT #${listing.token_id}`

  return (
    <Link
      href={`/listing/${listing.id}`}
      className="card group hover:border-lav/20 hover:shadow-glow-lav transition-all block"
    >
      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold ${
              isToken ? 'bg-green/10 text-green border border-green/10' : 'bg-lav/10 text-lav border border-lav/10'
            }`}>
              {isToken ? '$' : 'N'}
            </div>
            <div>
              <div className="text-tx font-semibold text-[15px]">{assetLabel}</div>
              <div className="text-tx3 text-xs mt-0.5 font-mono">
                {listing.nft_contract.slice(0, 8)}...{listing.nft_contract.slice(-4)}
              </div>
            </div>
          </div>
          <span className={isToken ? 'badge-green' : 'badge-lav'}>
            {isToken ? 'Token' : 'NFT'}
          </span>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-bg/60 rounded-lg px-3 py-2">
            <div className="text-tx3 text-[10px] uppercase tracking-wider font-medium">Price</div>
            <div className="text-tx font-semibold mt-0.5">{priceEth} ETH</div>
          </div>
          <div className="bg-bg/60 rounded-lg px-3 py-2">
            <div className="text-tx3 text-[10px] uppercase tracking-wider font-medium">Route</div>
            <div className="text-tx font-medium mt-0.5 text-sm">{assetChain} &rarr; {paymentChain}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-brd/50">
          <div className="text-tx3 text-xs">
            Seller: <span className="font-mono">{listing.seller.slice(0, 6)}...{listing.seller.slice(-4)}</span>
          </div>
          <div className="text-tx3 text-xs group-hover:text-lav transition-colors flex items-center gap-1">
            View Deal <span>&rarr;</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function Marketplace() {
  const [listings, setListings] = useState<NftListing[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')

  const loadListings = useCallback(async () => {
    try {
      const data = await api.getNftListings()
      setListings(data.listings.filter(l => l.status === 'Active'))
    } catch (err) {
      // Silent fail — marketplace shows empty state
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadListings()
    const interval = setInterval(loadListings, 15000)
    return () => clearInterval(interval)
  }, [loadListings])

  const filtered = listings.filter((l) => {
    if (filter === 'all') return true
    if (filter === 'erc20') return l.asset_type === 'ERC20'
    if (filter === 'nft') return l.asset_type === 'ERC721'
    return true
  })

  return (
    <div className="space-y-6 fi">
      {/* Hero section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 fi1">
        <div>
          <h1 className="text-3xl font-bold text-tx">Marketplace</h1>
          <p className="text-tx3 text-sm mt-1.5">
            Cross-chain OTC deals settled with ZK proofs
          </p>
        </div>
        <Link href="/list" className="btn btn-primary btn-lg">
          <span className="text-base">+</span>
          Create Deal
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 fi2">
        {([
          { key: 'all', label: 'All Deals' },
          { key: 'erc20', label: 'Tokens' },
          { key: 'nft', label: 'NFTs' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === key
                ? 'bg-lav/10 text-lav border border-lav/20'
                : 'text-tx3 hover:text-tx hover:bg-bg3 border border-transparent'
            }`}
          >
            {label}
          </button>
        ))}
        <span className="text-tx3 text-sm ml-auto font-mono">{filtered.length} active</span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 fi3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-5 space-y-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-bg3" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-bg3 rounded w-2/3" />
                  <div className="h-3 bg-bg3 rounded w-1/2" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="h-12 bg-bg3 rounded-lg" />
                <div className="h-12 bg-bg3 rounded-lg" />
              </div>
              <div className="h-px bg-brd/50" />
              <div className="h-3 bg-bg3 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center fi3">
          <div className="text-4xl mb-4 opacity-30">◆</div>
          <p className="text-tx text-lg font-semibold">No active deals</p>
          <p className="text-tx3 text-sm mt-2 max-w-xs mx-auto">
            Be the first to create a cross-chain deal on the marketplace
          </p>
          <Link href="/list" className="btn btn-primary mt-6 inline-flex">
            Create Deal
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 fi3">
          {filtered.map((listing) => (
            <DealCard key={`${listing.id}-${listing.on_chain_listing_id}`} listing={listing} />
          ))}
        </div>
      )}
    </div>
  )
}
