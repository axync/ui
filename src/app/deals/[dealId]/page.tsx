'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { api, Deal } from '@/services/api'
import { useWallet } from '@/hooks/useWallet'
import {
  formatAddress,
  formatAmount,
  signTransactionCorrect,
} from '@/utils/transactions'
import { parseWalletError } from '@/utils/walletErrors'
import { ethers } from 'ethers'
import { getChainName, getVaultContract, ASSETS } from '@/constants/config'

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Pending: 'badge-amber',
    Settled: 'badge-green',
    Cancelled: 'badge-red',
    Expired: 'badge-red',
  }
  return <span className={`badge ${map[status] || 'badge-muted'}`}>{status}</span>
}

export default function DealDetails() {
  const params = useParams()
  const router = useRouter()
  const dealId = (params?.dealId as string) || ''
  const [deal, setDeal] = useState<Deal | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const { address, accountState, walletInstalled, refreshAccountState, switchToChain } = useWallet()

  const loadDeal = useCallback(async (retries = 0) => {
    if (!dealId) return
    setLoading(true)
    setError(null)
    try {
      const dealData = await api.getDealDetails(parseInt(dealId))
      setDeal(dealData)
    } catch (err: any) {
      const is404 = err?.response?.status === 404 || err?.message?.includes('404') || err?.message?.includes('not found')
      if (is404 && retries < 5) {
        setTimeout(() => loadDeal(retries + 1), 2000)
        return
      }
      setError(is404 ? 'Deal is being processed. Please wait or refresh the page.' : parseWalletError(err))
    } finally {
      setLoading(false)
    }
  }, [dealId])

  useEffect(() => {
    if (dealId) loadDeal(0)
  }, [dealId, loadDeal])

  const handleAcceptDeal = async () => {
    if (!address || !window.ethereum) {
      setError('Please connect your wallet to accept this deal.')
      return
    }
    if (!accountState) {
      setError('Account is still loading. Please wait a moment.')
      return
    }
    if (!deal) return
    if (!deal.amount_remaining || !deal.price_quote_per_base) {
      setError('Deal data is incomplete. Please refresh the page.')
      return
    }

    setProcessing(true)
    setError(null)

    try {
      const amountToFill = BigInt(deal.amount_remaining)
      const amountQuote = amountToFill * BigInt(deal.price_quote_per_base)
      const requiredBalance = accountState.balances.find(
        (b: any) => b.asset_id === deal.asset_quote && b.chain_id === deal.chain_id_quote
      )
      const currentBalance = requiredBalance ? BigInt(requiredBalance.amount) : BigInt(0)

      let nonce = accountState.nonce

      if (currentBalance < amountQuote) {
        const depositAmount = amountQuote - currentBalance
        const chainId = deal.chain_id_quote

        const switched = await switchToChain(chainId)
        if (!switched) {
          setError(`Please switch to ${getChainName(chainId)} in your wallet.`)
          setProcessing(false)
          return
        }

        const provider = new ethers.BrowserProvider(window.ethereum)
        const signer = await provider.getSigner()
        const vaultContract = getVaultContract(chainId)

        if (!vaultContract || !ethers.isAddress(vaultContract)) {
          setError(`Vault contract not configured for ${getChainName(chainId)}.`)
          setProcessing(false)
          return
        }

        const contract = new ethers.Contract(
          vaultContract,
          ['function depositNative(uint256 assetId) external payable'],
          signer
        )

        const tx = await contract.depositNative(ASSETS.ETH.id, { value: depositAmount })
        const receipt = await tx.wait()

        const depositPayload = {
          txHash: receipt.hash,
          account: address,
          assetId: ASSETS.ETH.id,
          amount: depositAmount.toString(),
          chainId: chainId,
        }
        const depositSignature = await signTransactionCorrect(signer, address, nonce, 'Deposit', depositPayload)
        await api.submitTransaction({
          kind: 'Deposit',
          tx_hash: receipt.hash,
          account: address,
          asset_id: ASSETS.ETH.id,
          amount: depositAmount.toString(),
          chain_id: chainId,
          nonce: nonce,
          signature: depositSignature,
        })

        const expectedNonce = nonce + 1
        for (let attempt = 0; attempt < 15; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 1000))
          const state = await api.getAccountState(address)
          if (state.nonce >= expectedNonce) {
            nonce = state.nonce
            break
          }
          if (attempt === 14) {
            throw new Error('Deposit is taking longer than expected. Please try accepting the deal again.')
          }
        }
        await refreshAccountState()
      }

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const payload = { dealId: deal.deal_id, amount: null }
      const signature = await signTransactionCorrect(signer, address, nonce, 'AcceptDeal', payload)

      await api.submitTransaction({
        kind: 'AcceptDeal',
        from: address,
        deal_id: deal.deal_id,
        amount: null,
        nonce: nonce,
        signature: signature,
      })

      await loadDeal()
      await refreshAccountState()
    } catch (err: any) {
      setError(parseWalletError(err))
    } finally {
      setProcessing(false)
    }
  }

  const handleCancelDeal = async () => {
    if (!address || !window.ethereum || !accountState || !deal) {
      setError('Please connect your wallet to cancel this deal.')
      return
    }
    if (deal.maker.toLowerCase() !== address.toLowerCase()) {
      setError('Only the deal maker can cancel this deal.')
      return
    }

    if (!confirmCancel) {
      setConfirmCancel(true)
      return
    }

    setProcessing(true)
    setError(null)
    setConfirmCancel(false)

    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const nonce = accountState.nonce
      const payload = { dealId: deal.deal_id }
      const signature = await signTransactionCorrect(signer, address, nonce, 'CancelDeal', payload)

      const submitRequest = {
        kind: 'CancelDeal',
        from: address,
        deal_id: deal.deal_id,
        nonce: nonce,
        signature: signature,
      }

      await api.submitTransaction(submitRequest)
      await loadDeal()
      await refreshAccountState()
    } catch (err: any) {
      setError(parseWalletError(err))
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto py-16 text-center">
          <div className="w-5 h-5 mx-auto border-2 border-lav border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-tx3 text-sm">Loading deal...</p>
        </div>
      </Layout>
    )
  }

  if (error && !deal) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto">
          <button onClick={() => router.back()} className="text-tx3 hover:text-tx2 text-sm mb-6 transition-colors font-medium">
            &larr; Back to Deals
          </button>
          <div className="card text-center !p-10 space-y-4">
            <div className="w-12 h-12 mx-auto rounded-xl bg-red/10 flex items-center justify-center text-red text-xl">&#x26A0;</div>
            <p className="text-red text-sm">{error || 'Deal not found'}</p>
            <button onClick={() => loadDeal(0)} className="btn btn-outline btn-sm">Try Again</button>
          </div>
        </div>
      </Layout>
    )
  }

  if (!deal) return null

  const isMaker = deal?.maker?.toLowerCase() === address?.toLowerCase()
  const canAccept = !isMaker && deal?.status === 'Pending' && !!address && !!accountState

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6 fi">
          <button onClick={() => router.back()} className="text-tx3 hover:text-tx2 text-sm mb-4 transition-colors font-medium">
            &larr; Back to Deals
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold">Deal #AX-{String(deal.deal_id).padStart(4, '0')}</h2>
            <StatusBadge status={deal.status} />
            {deal.visibility === 'Direct' && <span className="badge badge-ice">Direct</span>}
          </div>
        </div>

        <div className="space-y-4">
          {/* Summary Card */}
          <div className="card card-grad fi1">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-tx3 uppercase tracking-wider">Amount</span>
                <div className="text-3xl font-bold text-gradient mt-1">
                  {formatAmount(BigInt(deal.amount_base))} ETH
                </div>
                {deal.amount_remaining != null && BigInt(deal.amount_remaining) > 0n && BigInt(deal.amount_remaining) !== BigInt(deal.amount_base) && (
                  <div className="text-sm text-tx2 mt-1">
                    Remaining: {formatAmount(BigInt(deal.amount_remaining))}
                  </div>
                )}
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold text-tx3 uppercase tracking-wider">Rate</span>
                <div className="text-2xl font-semibold text-tx mt-1 font-mono">{deal.price_quote_per_base}:1</div>
              </div>
            </div>
            <div className="mt-5 pt-5 border-t border-lav/10 flex items-center gap-2">
              <span className="w-[7px] h-[7px] rounded-full" style={{ background: deal.chain_id_base === 11155111 ? '#627EEA' : '#0052FF' }} />
              <span className="text-sm text-tx2">
                {getChainName(deal.chain_id_base)} &rarr; {getChainName(deal.chain_id_quote)}
              </span>
              <span className="badge badge-lav ml-auto" style={{ fontSize: '9px' }}>✓ ZK Verified</span>
            </div>
          </div>

          {/* Details */}
          <div className="card fi2">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <span className="text-[10px] font-semibold text-tx3 uppercase tracking-wider">Maker</span>
                <p className="font-mono text-sm text-tx2 mt-1">{formatAddress(deal.maker)}</p>
              </div>
              {deal.taker && (
                <div>
                  <span className="text-[10px] font-semibold text-tx3 uppercase tracking-wider">Taker</span>
                  <p className="font-mono text-sm text-tx2 mt-1">{formatAddress(deal.taker)}</p>
                </div>
              )}
              <div>
                <span className="text-[10px] font-semibold text-tx3 uppercase tracking-wider">Base Asset</span>
                <p className="text-sm text-tx mt-1">ETH</p>
                <p className="text-[10px] text-tx3">{getChainName(deal.chain_id_base)}</p>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-tx3 uppercase tracking-wider">Quote Asset</span>
                <p className="text-sm text-tx mt-1">ETH</p>
                <p className="text-[10px] text-tx3">{getChainName(deal.chain_id_quote)}</p>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 bg-red/5 rounded-xl border border-red/10 flex items-start gap-2.5">
              <span className="text-red text-sm mt-0.5">&#x26A0;</span>
              <div>
                <p className="text-red text-xs">{error}</p>
                <button onClick={() => setError(null)} className="text-red/60 text-[10px] mt-1 hover:text-red font-medium">Dismiss</button>
              </div>
            </div>
          )}

          {/* Cancel Confirmation */}
          {confirmCancel && (
            <div className="p-4 bg-amber/5 rounded-xl border border-amber/10">
              <p className="text-amber text-xs mb-3">Are you sure you want to cancel this deal? Your deposited funds will be returned to your balance.</p>
              <div className="flex gap-2">
                <button onClick={handleCancelDeal} className="btn btn-danger btn-sm">Yes, Cancel Deal</button>
                <button onClick={() => setConfirmCancel(false)} className="btn btn-outline btn-sm">Keep Deal</button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="card fi3">
            {!walletInstalled ? (
              <div className="text-center space-y-2">
                <p className="text-tx3 text-sm">No wallet detected.</p>
                <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="text-lav text-xs hover:underline">
                  Install MetaMask to interact with deals
                </a>
              </div>
            ) : !address ? (
              <p className="text-tx3 text-sm">Connect your wallet to interact with this deal.</p>
            ) : !accountState ? (
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-tx3 border-t-transparent rounded-full animate-spin" />
                <p className="text-tx3 text-sm">Loading account...</p>
              </div>
            ) : deal.status === 'Settled' ? (
              <div className="space-y-4">
                <div className="p-4 bg-green/5 rounded-xl border border-green/10">
                  <p className="text-green text-sm font-semibold mb-1">Deal Settled</p>
                  <p className="text-tx3 text-xs leading-relaxed">
                    {isMaker
                      ? `You received ${formatAmount(BigInt(deal.amount_remaining || deal.amount_base))} ETH on ${getChainName(deal.chain_id_quote)} from the taker.`
                      : `You sent ${formatAmount(BigInt(deal.amount_remaining || deal.amount_base))} ETH on ${getChainName(deal.chain_id_quote)} to the maker.`
                    }
                    {' '}You can now withdraw your funds to your wallet.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href="/withdrawals" className="btn btn-primary">Withdraw Funds</Link>
                  <Link href="/account" className="btn btn-outline">View Account</Link>
                </div>
              </div>
            ) : deal.status === 'Cancelled' ? (
              <div className="p-4 bg-red/5 rounded-xl border border-red/10">
                <p className="text-red text-sm font-semibold mb-1">Deal Cancelled</p>
                <p className="text-tx3 text-xs leading-relaxed">
                  This deal was cancelled. Deposited funds have been returned to the maker&apos;s balance.
                </p>
              </div>
            ) : (
              <div className="flex gap-2 items-center">
                {canAccept && (
                  <button onClick={handleAcceptDeal} disabled={processing} className="btn btn-primary">
                    {processing ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-bg border-t-transparent rounded-full animate-spin" />
                        Processing...
                      </span>
                    ) : (
                      'Accept Deal'
                    )}
                  </button>
                )}
                {isMaker && deal.status === 'Pending' && !confirmCancel && (
                  <button onClick={handleCancelDeal} disabled={processing} className="btn btn-danger">
                    {processing ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-red border-t-transparent rounded-full animate-spin" />
                        Processing...
                      </span>
                    ) : (
                      'Cancel Deal'
                    )}
                  </button>
                )}
                {isMaker && deal.status === 'Pending' && (
                  <p className="text-tx3 text-sm py-2.5">You created this deal.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
