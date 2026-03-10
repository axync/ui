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
  const styles: Record<string, string> = {
    Pending: 'bg-warning/10 text-warning',
    Settled: 'bg-success/10 text-success',
    Cancelled: 'bg-danger/10 text-danger',
    Expired: 'bg-muted/20 text-dim',
  }
  return (
    <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${styles[status] || styles.Expired}`}>
      {status}
    </span>
  )
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
          <div className="w-8 h-8 mx-auto border-2 border-accent border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-dim">Loading deal...</p>
        </div>
      </Layout>
    )
  }

  if (error && !deal) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto">
          <button onClick={() => router.back()} className="text-muted hover:text-dim text-sm mb-6 transition-colors font-medium">
            &larr; Back to Deals
          </button>
          <div className="bg-danger/5 rounded-2xl p-8 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-danger/10 flex items-center justify-center">
              <span className="text-danger text-2xl">&#x26A0;</span>
            </div>
            <p className="text-danger text-sm">{error || 'Deal not found'}</p>
            <button onClick={() => loadDeal(0)} className="btn-outline text-sm">
              Try Again
            </button>
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
        <div className="mb-8">
          <button onClick={() => router.back()} className="text-muted hover:text-dim text-sm mb-6 transition-colors font-medium">
            &larr; Back to Deals
          </button>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-3xl font-bold text-bright tracking-tight">Deal #{deal.deal_id}</h1>
            <StatusBadge status={deal.status} />
            {deal.visibility === 'Direct' && (
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-info/10 text-info">Direct</span>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Summary Card */}
          <div className="bg-surface rounded-2xl p-8 shadow-elevation-1">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-muted uppercase tracking-wider">Amount</span>
                <div className="font-heading text-3xl font-bold text-bright mt-1">
                  {formatAmount(BigInt(deal.amount_base))} ETH
                </div>
                {deal.amount_remaining != null && BigInt(deal.amount_remaining) > 0n && BigInt(deal.amount_remaining) !== BigInt(deal.amount_base) && (
                  <div className="text-sm text-dim mt-1">
                    Remaining: {formatAmount(BigInt(deal.amount_remaining))}
                  </div>
                )}
              </div>
              <div className="text-right">
                <span className="text-xs font-medium text-muted uppercase tracking-wider">Rate</span>
                <div className="font-heading text-2xl font-semibold text-bright mt-1">{deal.price_quote_per_base}:1</div>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-edge/40">
              <span className="text-sm text-dim">
                {getChainName(deal.chain_id_base)} &rarr; {getChainName(deal.chain_id_quote)}
              </span>
            </div>
          </div>

          {/* Details */}
          <div className="bg-surface rounded-2xl p-8 shadow-elevation-1">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <span className="text-xs font-medium text-muted uppercase tracking-wider">Maker</span>
                <p className="font-mono text-sm text-dim mt-1.5">{formatAddress(deal.maker)}</p>
              </div>
              {deal.taker && (
                <div>
                  <span className="text-xs font-medium text-muted uppercase tracking-wider">Taker</span>
                  <p className="font-mono text-sm text-dim mt-1.5">{formatAddress(deal.taker)}</p>
                </div>
              )}
              <div>
                <span className="text-xs font-medium text-muted uppercase tracking-wider">Base Asset</span>
                <p className="text-sm text-bright mt-1.5">ETH (ID: {deal.asset_base})</p>
                <p className="text-xs text-muted mt-0.5">{getChainName(deal.chain_id_base)}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-muted uppercase tracking-wider">Quote Asset</span>
                <p className="text-sm text-bright mt-1.5">ETH (ID: {deal.asset_quote})</p>
                <p className="text-xs text-muted mt-0.5">{getChainName(deal.chain_id_quote)}</p>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-5 bg-danger/5 rounded-2xl flex items-start gap-3">
              <span className="text-danger text-sm mt-0.5">&#x26A0;</span>
              <div>
                <p className="text-danger text-sm">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-danger/60 text-xs mt-1.5 hover:text-danger transition-colors font-medium"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Cancel Confirmation */}
          {confirmCancel && (
            <div className="p-5 bg-warning/5 rounded-2xl">
              <p className="text-warning text-sm mb-4">Are you sure you want to cancel this deal? Your deposited funds will be returned to your balance.</p>
              <div className="flex gap-3">
                <button onClick={handleCancelDeal} className="btn-danger text-sm">
                  Yes, Cancel Deal
                </button>
                <button onClick={() => setConfirmCancel(false)} className="btn-outline text-sm">
                  Keep Deal
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="bg-surface rounded-2xl p-8 shadow-elevation-1">
            {!walletInstalled ? (
              <div className="text-center space-y-2">
                <p className="text-dim text-sm">No wallet detected.</p>
                <a
                  href="https://metamask.io/download/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent text-xs hover:underline"
                >
                  Install MetaMask to interact with deals
                </a>
              </div>
            ) : !address ? (
              <p className="text-dim text-sm">Connect your wallet to interact with this deal.</p>
            ) : !accountState ? (
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-dim border-t-transparent rounded-full animate-spin" />
                <p className="text-dim text-sm">Loading account...</p>
              </div>
            ) : deal.status === 'Settled' ? (
              <div className="space-y-5">
                <div className="p-5 bg-success/5 rounded-xl">
                  <p className="text-success text-sm font-semibold mb-1">Deal Settled</p>
                  <p className="text-dim text-xs leading-relaxed">
                    {isMaker
                      ? `You received ${formatAmount(BigInt(deal.amount_remaining || deal.amount_base))} ETH on ${getChainName(deal.chain_id_quote)} from the taker.`
                      : `You sent ${formatAmount(BigInt(deal.amount_remaining || deal.amount_base))} ETH on ${getChainName(deal.chain_id_quote)} to the maker.`
                    }
                    {' '}You can now withdraw your funds to your wallet.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Link href="/withdrawals" className="btn-silver">
                    Withdraw Funds
                  </Link>
                  <Link href="/account" className="btn-outline">
                    View Account
                  </Link>
                </div>
              </div>
            ) : deal.status === 'Cancelled' ? (
              <div className="p-5 bg-danger/5 rounded-xl">
                <p className="text-danger text-sm font-semibold mb-1">Deal Cancelled</p>
                <p className="text-dim text-xs leading-relaxed">
                  This deal was cancelled. Deposited funds have been returned to the maker&apos;s balance.
                </p>
              </div>
            ) : (
              <div className="flex gap-3 items-center">
                {canAccept && (
                  <button onClick={handleAcceptDeal} disabled={processing} className="btn-silver">
                    {processing ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-base border-t-transparent rounded-full animate-spin" />
                        Processing...
                      </span>
                    ) : (
                      'Accept Deal'
                    )}
                  </button>
                )}
                {isMaker && deal.status === 'Pending' && !confirmCancel && (
                  <button onClick={handleCancelDeal} disabled={processing} className="btn-danger">
                    {processing ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-danger border-t-transparent rounded-full animate-spin" />
                        Processing...
                      </span>
                    ) : (
                      'Cancel Deal'
                    )}
                  </button>
                )}
                {isMaker && deal.status === 'Pending' && (
                  <p className="text-dim text-sm py-2.5">You created this deal.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
