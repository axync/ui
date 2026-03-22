'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useWallet } from '@/hooks/useWallet'
import { api, NftListing, AccountState } from '@/services/api'
import { getContracts } from '@/config/contracts'
import { ethers } from 'ethers'

type Tab = 'listings' | 'balances'

export default function Portfolio() {
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

      // Filter listings where user is seller or buyer
      const myListings = listingsData.listings.filter(
        l => l.seller.toLowerCase() === address.toLowerCase() ||
             (l.buyer && l.buyer.toLowerCase() === address.toLowerCase())
      )
      setListings(myListings)
      setAccount(accountData)
    } catch (err) {
      console.error('Failed to load portfolio:', err)
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (!address) {
    return (
      <div className="card p-12 text-center">
        <p className="text-tx2 text-lg font-medium">Connect your wallet</p>
        <p className="text-tx3 text-sm mt-2">View your listings and sequencer balances</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-tx">Portfolio</h1>
        <p className="text-tx3 text-sm mt-1 font-mono">{address}</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        {(['listings', 'balances'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === t
                ? 'bg-lav/10 text-lav border border-lav/20'
                : 'text-tx3 hover:text-tx hover:bg-bg3 border border-transparent'
            }`}
          >
            {t === 'listings' ? 'My Listings' : 'Sequencer Balances'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-12 text-center text-tx3">Loading...</div>
      ) : tab === 'listings' ? (
        /* Listings Tab */
        listings.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-tx2 text-lg font-medium">No listings yet</p>
            <p className="text-tx3 text-sm mt-2">List your first asset</p>
            <Link href="/list" className="btn btn-primary mt-4 inline-block">
              List Asset
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {listings.map((listing) => {
              const isSeller = listing.seller.toLowerCase() === address.toLowerCase()
              const priceEth = ethers.formatEther(listing.price)
              const assetChain = getContracts(listing.nft_chain_id)
              const paymentChain = getContracts(listing.payment_chain_id)

              return (
                <Link key={`${listing.id}-${listing.on_chain_listing_id}`} href={`/listing/${listing.id}`} className="card hover:border-lav/30 transition-all">
                  <div className="p-5 flex items-center gap-5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                      listing.asset_type === 'ERC20' ? 'bg-green/10 text-green' : 'bg-lav/10 text-lav'
                    }`}>
                      {listing.asset_type === 'ERC20' ? '$' : 'N'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-tx font-medium">
                          {listing.asset_type === 'ERC20'
                            ? `${ethers.formatEther(listing.amount?.toString() || '0')} tokens`
                            : `NFT #${listing.token_id}`
                          }
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          isSeller ? 'bg-amber/10 text-amber' : 'bg-ice/10 text-ice'
                        }`}>
                          {isSeller ? 'SELLING' : 'BOUGHT'}
                        </span>
                      </div>
                      <div className="text-tx3 text-sm mt-0.5">
                        {assetChain?.shortName} &rarr; {paymentChain?.shortName}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-tx font-semibold">{priceEth} ETH</div>
                      <div className={`text-xs font-medium ${
                        listing.status === 'Active' ? 'text-green' :
                        listing.status === 'Sold' ? 'text-lav' : 'text-red'
                      }`}>
                        {listing.status}
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )
      ) : (
        /* Balances Tab */
        <div className="card p-6 space-y-4">
          <h3 className="text-lg font-bold text-tx">Sequencer Balances</h3>
          <p className="text-tx3 text-sm">
            Balances deposited into AxyncVault and tracked by the sequencer
          </p>

          {!account || !account.balances || account.balances.length === 0 ? (
            <div className="bg-bg2 rounded-xl p-6 text-center">
              <p className="text-tx3 text-sm">No balances in sequencer</p>
              <p className="text-tx3 text-xs mt-1">Deposit ETH into AxyncVault to start trading</p>
            </div>
          ) : (
            <div className="space-y-2">
              {account.balances.map((b, i) => (
                <div key={i} className="flex items-center justify-between bg-bg2 rounded-xl p-4">
                  <div>
                    <div className="text-tx font-medium">
                      Asset #{b.asset_id} {b.asset_id === 0 ? '(ETH)' : ''}
                    </div>
                    <div className="text-tx3 text-xs">
                      Chain: {getContracts(b.chain_id)?.shortName || b.chain_id}
                    </div>
                  </div>
                  <div className="text-tx font-semibold">
                    {ethers.formatEther(b.amount.toString())}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-bg2 rounded-xl p-4 flex justify-between items-center">
            <div>
              <div className="text-tx2 text-sm font-medium">Nonce</div>
              <div className="text-tx3 text-xs">Transaction counter in sequencer</div>
            </div>
            <div className="text-tx font-mono">{account?.nonce || 0}</div>
          </div>
        </div>
      )}
    </div>
  )
}
