'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { api, NftListing } from '@/services/api'
import { getContracts } from '@/config/contracts'
import { ethers } from 'ethers'

type Filter = 'all' | 'erc20' | 'nft'

export default function Marketplace() {
  const [listings, setListings] = useState<NftListing[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')

  const loadListings = useCallback(async () => {
    try {
      const data = await api.getNftListings()
      setListings(data.listings.filter(l => l.status === 'Active'))
    } catch (err) {
      console.error('Failed to load listings:', err)
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

  function getAssetIcon(listing: NftListing) {
    if (listing.asset_type === 'ERC20') return { letter: '$', bg: 'bg-green/10 text-green' }
    return { letter: 'N', bg: 'bg-lav/10 text-lav' }
  }

  function getChainName(chainId: number): string {
    return getContracts(chainId)?.shortName || `Chain ${chainId}`
  }

  return (
    <div className="space-y-6 fi">
      <div className="flex items-end justify-between fi1">
        <div>
          <h1 className="text-2xl font-bold text-tx">Marketplace</h1>
          <p className="text-tx3 text-sm mt-1">Trade tokens and vesting positions cross-chain</p>
        </div>
        <Link href="/list" className="btn btn-primary">
          List Asset
        </Link>
      </div>

      <div className="flex items-center gap-2 fi2">
        {(['all', 'erc20', 'nft'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filter === f
                ? 'bg-lav/10 text-lav border border-lav/20'
                : 'text-tx3 hover:text-tx hover:bg-bg3 border border-transparent'
            }`}
          >
            {f === 'all' ? 'All' : f === 'erc20' ? 'Tokens' : 'NFT'}
          </button>
        ))}
        <span className="text-tx3 text-sm ml-auto">{filtered.length} active</span>
      </div>

      {loading ? (
        <div className="card p-12 text-center text-tx3">Loading listings...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-tx2 text-lg font-medium">No active listings</p>
          <p className="text-tx3 text-sm mt-2">Be the first to list an asset</p>
          <Link href="/list" className="btn btn-primary mt-4 inline-block">
            List Asset
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 fi3">
          {filtered.map((listing) => {
            const icon = getAssetIcon(listing)
            const priceEth = ethers.formatEther(listing.price)
            const assetChain = getChainName(listing.nft_chain_id)
            const paymentChain = getChainName(listing.payment_chain_id)

            return (
              <Link key={`${listing.id}-${listing.on_chain_listing_id}`} href={`/listing/${listing.id}`} className="card hover:border-lav/30 transition-all group">
                <div className="p-5 flex items-center gap-6">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${icon.bg}`}>
                    {icon.letter}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-tx font-medium">
                        {listing.asset_type === 'ERC20'
                          ? `${ethers.formatEther(listing.amount?.toString() || '0')} tokens`
                          : `NFT #${listing.token_id}`
                        }
                      </span>
                      <span className={listing.asset_type === 'ERC20' ? 'badge-green' : 'badge-lav'}>
                        {listing.asset_type === 'ERC20' ? 'Token' : 'NFT'}
                      </span>
                    </div>
                    <div className="text-tx3 text-sm mt-0.5 flex items-center gap-3">
                      <span>{listing.seller.slice(0, 6)}...{listing.seller.slice(-4)}</span>
                      <span className="text-tx3/50">|</span>
                      <span>{assetChain} &rarr; {paymentChain}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-tx font-semibold">{priceEth} ETH</div>
                    <div className="text-tx3 text-xs">{listing.nft_contract.slice(0, 8)}...</div>
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
