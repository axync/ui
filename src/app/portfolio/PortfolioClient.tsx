'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useWallet } from '@/hooks/useWallet'
import { api, NftListing, AccountState } from '@/services/api'
import { getContracts } from '@/config/contracts'
import { ethers } from 'ethers'

type Tab = 'listings' | 'balances'

export default function PortfolioClient() {
  const { address } = useWallet()
  const [tab, setTab] = useState<Tab>('listings')
  const [listings, setListings] = useState<NftListing[]>([])
  const [account, setAccount] = useState<AccountState | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    if (!address) return
    setLoading(true)
    try {
      const [listingsData, accountData] = await Promise.all([
        api.getNftListings(),
        api.getAccountState(address).catch(() => null),
      ])

      const myListings = listingsData.listings.filter(
        l => l.seller.toLowerCase() === address.toLowerCase() ||
             (l.buyer && l.buyer.toLowerCase() === address.toLowerCase())
      )
      setListings(myListings)
      setAccount(accountData)
    } catch (err) {
      // Silent fail — portfolio shows empty state
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (!address) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card p-12 text-center space-y-3">
          <div className="text-3xl opacity-30">&#9678;</div>
          <p className="text-tx text-lg font-semibold">Connect Wallet</p>
          <p className="text-tx3 text-sm">View your deals and sequencer balances</p>
        </div>
      </div>
    )
  }

  const activeListings = listings.filter(l => l.status === 'Active')
  const completedListings = listings.filter(l => l.status !== 'Active')

  return (
    <div className="space-y-6 fi">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 fi1">
        <div>
          <h1 className="text-3xl font-bold text-tx">Portfolio</h1>
          <p className="text-tx3 text-sm mt-1 font-mono">{address.slice(0, 8)}...{address.slice(-6)}</p>
        </div>
        <Link href="/list" className="btn btn-primary">
          <span className="text-base">+</span>
          Create Deal
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 fi2">
        <div className="card p-4">
          <div className="text-tx3 text-[10px] uppercase tracking-wider font-medium">Total Deals</div>
          <div className="text-tx font-bold text-2xl mt-1">{listings.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-tx3 text-[10px] uppercase tracking-wider font-medium">Active</div>
          <div className="text-green font-bold text-2xl mt-1">{activeListings.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-tx3 text-[10px] uppercase tracking-wider font-medium">Completed</div>
          <div className="text-lav font-bold text-2xl mt-1">{completedListings.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-tx3 text-[10px] uppercase tracking-wider font-medium">Seq. Nonce</div>
          <div className="text-tx font-bold text-2xl mt-1 font-mono">{account?.nonce || 0}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-brd pb-0 fi3">
        {([
          { key: 'listings', label: 'My Deals', count: listings.length },
          { key: 'balances', label: 'Sequencer Balances', count: account?.balances?.length || 0 },
        ] as const).map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
              tab === key
                ? 'text-lav border-lav'
                : 'text-tx3 border-transparent hover:text-tx'
            }`}
          >
            {label}
            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-md ${
              tab === key ? 'bg-lav/10 text-lav' : 'bg-bg3 text-tx3'
            }`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-bg3" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-bg3 rounded w-1/3" />
                  <div className="h-3 bg-bg3 rounded w-1/4" />
                </div>
                <div className="w-20 h-6 bg-bg3 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : tab === 'listings' ? (
        listings.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-3xl opacity-30 mb-3">&#9678;</div>
            <p className="text-tx font-semibold">No deals yet</p>
            <p className="text-tx3 text-sm mt-1">Create your first cross-chain deal</p>
            <Link href="/list" className="btn btn-primary mt-5 inline-flex">
              Create Deal
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {listings.map((listing) => {
              const isSeller = listing.seller.toLowerCase() === address.toLowerCase()
              const priceEth = ethers.formatEther(listing.price)
              const assetChain = getContracts(listing.nft_chain_id)
              const paymentChain = getContracts(listing.payment_chain_id)
              const isToken = listing.asset_type === 'ERC20'

              return (
                <Link
                  key={`${listing.id}-${listing.on_chain_listing_id}`}
                  href={`/listing/${listing.id}`}
                  className="card hover:border-lav/20 transition-all block group"
                >
                  <div className="p-5 flex items-center gap-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      isToken ? 'bg-green/10 text-green border border-green/10' : 'bg-lav/10 text-lav border border-lav/10'
                    }`}>
                      {isToken ? '$' : 'N'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-tx font-semibold">
                          {isToken
                            ? `${ethers.formatEther(listing.amount?.toString() || '0')} tokens`
                            : `NFT #${listing.token_id}`
                          }
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          isSeller ? 'bg-amber/10 text-amber' : 'bg-ice/10 text-ice'
                        }`}>
                          {isSeller ? 'SELLING' : 'BOUGHT'}
                        </span>
                      </div>
                      <div className="text-tx3 text-sm mt-0.5">
                        {assetChain?.shortName} &rarr; {paymentChain?.shortName}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="text-tx font-semibold">{priceEth} ETH</div>
                      <div className={`text-xs font-semibold ${
                        listing.status === 'Active' ? 'text-green' :
                        listing.status === 'Sold' ? 'text-lav' : 'text-red'
                      }`}>
                        {listing.status}
                      </div>
                    </div>

                    <div className="text-tx3 group-hover:text-lav transition-colors flex-shrink-0">&rarr;</div>
                  </div>
                </Link>
              )
            })}
          </div>
        )
      ) : (
        /* Balances Tab */
        <div className="space-y-4">
          {!account || !account.balances || account.balances.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="text-3xl opacity-30 mb-3">$</div>
              <p className="text-tx font-semibold">No balances</p>
              <p className="text-tx3 text-sm mt-1 max-w-xs mx-auto">
                Deposit ETH into AxyncVault to start trading cross-chain
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {account.balances.map((b, i) => (
                <div key={i} className="card p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-ice/10 text-ice border border-ice/10 flex items-center justify-center text-sm font-bold">
                      {b.asset_id === 0 ? 'E' : '#'}
                    </div>
                    <div>
                      <div className="text-tx font-semibold">
                        Asset #{b.asset_id} {b.asset_id === 0 ? '(ETH)' : ''}
                      </div>
                      <div className="text-tx3 text-xs">
                        {getContracts(b.chain_id)?.shortName || `Chain ${b.chain_id}`}
                      </div>
                    </div>
                  </div>
                  <div className="text-tx font-bold text-lg font-mono">
                    {ethers.formatEther(b.amount.toString())}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
