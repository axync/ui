'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ethers } from 'ethers'
import { useWallet } from '@/hooks/useWallet'
import { api, Listing, VestingPosition } from '@/services/api'
import { formatAmount, formatAddress } from '@/utils/transactions'

export default function ListingDetail() {
  const { id } = useParams()
  const router = useRouter()
  const { address } = useWallet()
  const [listing, setListing] = useState<Listing | null>(null)
  const [vesting, setVesting] = useState<VestingPosition | null>(null)
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState(false)
  const [txStatus, setTxStatus] = useState('')

  const escrowContract = process.env.NEXT_PUBLIC_ESCROW_CONTRACT || ''

  useEffect(() => {
    if (id) loadListing()
  }, [id])

  async function loadListing() {
    try {
      const data = await api.getListingDetail(Number(id))
      setListing(data.listing)
      setVesting(data.vesting)
    } catch (err) {
      console.error('Failed to load listing:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleBuy() {
    if (!listing || !escrowContract || !address) return

    const provider = new ethers.BrowserProvider((window as any).ethereum)
    const signer = await provider.getSigner()

    try {
      setBuying(true)
      const isEth = listing.payment_token === '0x0000000000000000000000000000000000000000'

      const escrowABI = ['function buy(uint256 listingId) external payable']
      const escrow = new ethers.Contract(escrowContract, escrowABI, signer)

      if (isEth) {
        setTxStatus('Confirm transaction in wallet...')
        const tx = await escrow.buy(listing.id, { value: BigInt(listing.price) })
        setTxStatus('Waiting for confirmation...')
        await tx.wait()
      } else {
        // ERC-20: approve first, then buy
        const erc20ABI = [
          'function approve(address spender, uint256 amount) external returns (bool)',
          'function allowance(address owner, address spender) view returns (uint256)',
        ]
        const token = new ethers.Contract(listing.payment_token, erc20ABI, signer)

        const allowance = await token.allowance(address, escrowContract)
        if (allowance < BigInt(listing.price)) {
          setTxStatus('Approving token spend...')
          const approveTx = await token.approve(escrowContract, BigInt(listing.price))
          await approveTx.wait()
        }

        setTxStatus('Confirm purchase...')
        const tx = await escrow.buy(listing.id)
        setTxStatus('Waiting for confirmation...')
        await tx.wait()
      }

      setTxStatus('Purchase complete!')
      setTimeout(() => router.push('/portfolio'), 2000)
    } catch (err: any) {
      console.error('Purchase failed:', err)
      setTxStatus(`Error: ${err.reason || err.message || 'Transaction failed'}`)
      setBuying(false)
    }
  }

  function formatTime(ts: number): string {
    if (!ts) return '—'
    return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function calcProgress(): number {
    if (!vesting || !vesting.start_time || !vesting.end_time) return 0
    const now = Math.floor(Date.now() / 1000)
    const total = vesting.end_time - vesting.start_time
    if (total <= 0) return 100
    const elapsed = now - vesting.start_time
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)))
  }

  if (loading) {
    return <div className="card p-12 text-center text-tx3 fi">Loading listing...</div>
  }

  if (!listing) {
    return (
      <div className="card p-12 text-center fi">
        <p className="text-tx2 font-medium">Listing not found</p>
        <button onClick={() => router.push('/')} className="btn btn-secondary mt-4">Back to Marketplace</button>
      </div>
    )
  }

  const isEth = listing.payment_token === '0x0000000000000000000000000000000000000000'
  const isSeller = address?.toLowerCase() === listing.seller.toLowerCase()
  const progress = calcProgress()

  return (
    <div className="space-y-6 fi">
      <button onClick={() => router.push('/')} className="text-tx3 hover:text-tx text-sm transition-colors fi1">
        ← Back to Marketplace
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Header card */}
          <div className="card-grad p-6 fi2">
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${
                vesting?.platform === 'sablier' ? 'bg-amber/20 text-amber' : 'bg-green/20 text-green'
              }`}>
                {vesting?.platform === 'sablier' ? 'S' : vesting?.platform === 'hedgey' ? 'H' : '?'}
              </div>
              <div>
                <h1 className="text-xl font-bold text-tx">
                  {vesting?.platform ? vesting.platform.charAt(0).toUpperCase() + vesting.platform.slice(1) : 'Vesting'} Stream #{listing.token_id}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  {vesting && (
                    <span className={`badge-${vesting.status === 'Streaming' ? 'green' : vesting.status === 'Settled' ? 'lav' : 'muted'}`}>
                      {vesting.status}
                    </span>
                  )}
                  {vesting?.is_transferable && <span className="badge-ice">Transferable</span>}
                  {vesting?.is_cancelable && <span className="badge-amber">Cancelable</span>}
                </div>
              </div>
            </div>

            {vesting && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-tx3 text-xs uppercase tracking-wider">Total Amount</div>
                  <div className="text-tx font-semibold mt-1">{formatAmount(BigInt(vesting.total_amount))} tokens</div>
                </div>
                <div>
                  <div className="text-tx3 text-xs uppercase tracking-wider">Withdrawn</div>
                  <div className="text-tx font-semibold mt-1">{formatAmount(BigInt(vesting.withdrawn_amount))} tokens</div>
                </div>
              </div>
            )}
          </div>

          {/* Vesting schedule */}
          {vesting && (
            <div className="card p-5 fi3">
              <h2 className="text-tx font-semibold mb-4">Vesting Schedule</h2>

              <div className="flex justify-between text-sm text-tx3 mb-2">
                <span>{formatTime(vesting.start_time)}</span>
                <span>{progress}% vested</span>
                <span>{formatTime(vesting.end_time)}</span>
              </div>
              <div className="w-full h-2 bg-bg4 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-lav to-ice rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>

              {vesting.withdrawable_amount !== '0' && (
                <div className="mt-4 p-3 rounded-lg bg-green/5 border border-green/10">
                  <div className="text-green text-sm font-medium">
                    {formatAmount(BigInt(vesting.withdrawable_amount))} tokens available to claim now
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Contract details */}
          <div className="card p-5 fi4">
            <h2 className="text-tx font-semibold mb-3">Details</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-tx3">NFT Contract</span>
                <span className="text-tx font-mono">{formatAddress(listing.nft_contract)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-tx3">Token ID</span>
                <span className="text-tx">{listing.token_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-tx3">Seller</span>
                <span className="text-tx font-mono">{formatAddress(listing.seller)}</span>
              </div>
              {vesting?.token && (
                <div className="flex justify-between">
                  <span className="text-tx3">Underlying Token</span>
                  <span className="text-tx font-mono">{formatAddress(vesting.token)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Buy panel */}
        <div className="space-y-4">
          <div className="card p-5 sticky top-20">
            <div className="text-tx3 text-xs uppercase tracking-wider mb-1">Price</div>
            <div className="text-3xl font-bold text-tx">
              {formatAmount(BigInt(listing.price))}
              <span className="text-lg text-tx2 ml-2">{isEth ? 'ETH' : 'USDC'}</span>
            </div>

            {vesting && BigInt(vesting.total_amount) > 0n && (
              <div className="mt-3 p-3 rounded-lg bg-green/5 border border-green/10">
                <div className="text-green text-sm font-medium">
                  {((BigInt(vesting.total_amount) - BigInt(listing.price)) * 100n / BigInt(vesting.total_amount)).toString()}% discount
                </div>
                <div className="text-tx3 text-xs mt-0.5">vs full token value</div>
              </div>
            )}

            {buying ? (
              <div className="mt-4 p-4 rounded-lg bg-bg3 text-center">
                <div className="animate-pulse text-lav font-medium">{txStatus || 'Processing...'}</div>
              </div>
            ) : isSeller ? (
              <div className="mt-4 text-tx3 text-sm text-center">This is your listing</div>
            ) : (
              <button
                onClick={handleBuy}
                disabled={!address || !escrowContract || !listing.active}
                className="btn btn-primary w-full mt-4 disabled:opacity-50"
              >
                {!address ? 'Connect Wallet' : !listing.active ? 'Listing Inactive' : `Buy for ${formatAmount(BigInt(listing.price))} ${isEth ? 'ETH' : 'USDC'}`}
              </button>
            )}

            {!listing.active && (
              <div className="mt-3 text-red text-sm text-center">This listing is no longer active</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
