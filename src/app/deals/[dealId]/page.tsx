'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import { api, Deal } from '@/services/api'
import {
  formatAddress,
  formatAmount,
  signTransactionCorrect,
} from '@/utils/transactions'
import { ethers } from 'ethers'
import { getChainName } from '@/constants/config'

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Pending: 'bg-warning/10 text-warning',
    Settled: 'bg-success/10 text-success',
    Cancelled: 'bg-danger/10 text-danger',
    Expired: 'bg-muted/20 text-dim',
  }
  return (
    <span className={`font-mono text-[10px] px-2.5 py-1 rounded-md ${styles[status] || styles.Expired}`}>
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
  const [address, setAddress] = useState<string | null>(null)
  const [accountState, setAccountState] = useState<any>(null)
  const [processing, setProcessing] = useState(false)

  const loadAccountState = async (addr: string) => {
    try {
      const state = await api.getAccountState(addr)
      setAccountState(state)
    } catch (err) {
      console.error('Error loading account state:', err)
    }
  }

  const loadDeal = useCallback(async () => {
    if (!dealId) return
    setLoading(true)
    setError(null)
    try {
      const dealData = await api.getDealDetails(parseInt(dealId))
      setDeal(dealData)
    } catch (err: any) {
      setError(err.message || 'Failed to load deal')
    } finally {
      setLoading(false)
    }
  }, [dealId])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum
        .request({ method: 'eth_accounts' })
        .then((accounts: string[]) => {
          if (accounts.length > 0) {
            setAddress(accounts[0])
            loadAccountState(accounts[0])
          }
        })
        .catch(console.error)
    }
    if (dealId) loadDeal()
  }, [dealId, loadDeal])

  const handleAcceptDeal = async () => {
    if (!address || !window.ethereum || !accountState || !deal) {
      alert('Please connect your wallet and wait for account to load')
      return
    }
    if (!deal.amount_remaining || !deal.price_quote_per_base) {
      setError('Deal data is incomplete')
      return
    }

    const amountToFill = BigInt(deal.amount_remaining)
    const amountQuote = amountToFill * BigInt(deal.price_quote_per_base)
    const requiredBalance = accountState.balances.find(
      (b: any) => b.asset_id === deal.asset_quote && b.chain_id === deal.chain_id_quote
    )
    const currentBalance = requiredBalance ? BigInt(requiredBalance.amount) : BigInt(0)

    if (currentBalance < amountQuote) {
      const chainName = getChainName(deal.chain_id_quote)
      setError(
        `Insufficient balance! You need ${formatAmount(amountQuote)} on ${chainName} to accept this deal. ` +
        `You currently have ${formatAmount(currentBalance)}. Please make a deposit first.`
      )
      return
    }

    setProcessing(true)
    setError(null)

    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const nonce = accountState.nonce
      const payload = { dealId: deal.deal_id, amount: null }
      const signature = await signTransactionCorrect(signer, address, nonce, 'AcceptDeal', payload)

      const submitRequest = {
        kind: 'AcceptDeal',
        from: address,
        deal_id: deal.deal_id,
        amount: null,
        nonce: nonce,
        signature: signature,
      }

      await api.submitTransaction(submitRequest)
      await loadDeal()
      await loadAccountState(address)
    } catch (err: any) {
      setError(err.message || 'Failed to accept deal')
    } finally {
      setProcessing(false)
    }
  }

  const handleCancelDeal = async () => {
    if (!address || !window.ethereum || !accountState || !deal) {
      alert('Please connect your wallet and wait for account to load')
      return
    }
    if (deal.maker.toLowerCase() !== address.toLowerCase()) {
      alert('Only the maker can cancel this deal')
      return
    }
    if (!confirm('Are you sure you want to cancel this deal?')) return

    setProcessing(true)
    setError(null)

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
      await loadAccountState(address)
    } catch (err: any) {
      setError(err.message || 'Failed to cancel deal')
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto py-12 text-center">
          <p className="text-dim">Loading deal...</p>
        </div>
      </Layout>
    )
  }

  if (error && !deal) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto">
          <div className="bg-danger/5 border border-danger/20 rounded-2xl p-6">
            <p className="text-danger text-sm">{error || 'Deal not found'}</p>
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
        <div className="mb-6">
          <button onClick={() => router.back()} className="text-dim hover:text-silver-lo text-sm mb-4 transition-colors">
            &larr; Back to Deals
          </button>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-bold text-bright">Deal #{deal.deal_id}</h1>
            <StatusBadge status={deal.status} />
            {deal.visibility === 'Direct' && (
              <span className="font-mono text-[10px] px-2.5 py-1 rounded-md bg-info/10 text-info">Direct</span>
            )}
          </div>
        </div>

        <div className="bg-surface border border-edge rounded-2xl p-6 space-y-6">
          {/* Summary */}
          <div className="bg-base border border-edge rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-[9px] tracking-[3px] uppercase text-silver-lo">Amount</span>
                <div className="font-heading text-2xl font-bold text-bright mt-1">
                  {formatAmount(BigInt(deal.amount_base))} ETH
                </div>
                {deal.amount_remaining && BigInt(deal.amount_remaining) !== BigInt(deal.amount_base) && (
                  <div className="font-mono text-xs text-dim mt-1">
                    Remaining: {formatAmount(BigInt(deal.amount_remaining))}
                  </div>
                )}
              </div>
              <div className="text-right">
                <span className="font-mono text-[9px] tracking-[3px] uppercase text-silver-lo">Rate</span>
                <div className="font-heading text-xl font-semibold text-bright mt-1">{deal.price_quote_per_base}:1</div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-edge">
              <span className="font-mono text-xs text-silver-lo">
                {getChainName(deal.chain_id_base)} &rarr; {getChainName(deal.chain_id_quote)}
              </span>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="font-mono text-[9px] tracking-[3px] uppercase text-muted">Maker</span>
              <p className="font-mono text-sm text-silver-lo mt-1">{formatAddress(deal.maker)}</p>
            </div>
            {deal.taker && (
              <div>
                <span className="font-mono text-[9px] tracking-[3px] uppercase text-muted">Taker</span>
                <p className="font-mono text-sm text-silver-lo mt-1">{formatAddress(deal.taker)}</p>
              </div>
            )}
            <div>
              <span className="font-mono text-[9px] tracking-[3px] uppercase text-muted">Base Asset</span>
              <p className="text-sm text-bright mt-1">ETH (ID: {deal.asset_base})</p>
              <p className="font-mono text-[10px] text-dim">{getChainName(deal.chain_id_base)}</p>
            </div>
            <div>
              <span className="font-mono text-[9px] tracking-[3px] uppercase text-muted">Quote Asset</span>
              <p className="text-sm text-bright mt-1">ETH (ID: {deal.asset_quote})</p>
              <p className="font-mono text-[10px] text-dim">{getChainName(deal.chain_id_quote)}</p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 bg-danger/5 border border-danger/20 rounded-xl">
              <p className="text-danger text-sm">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="pt-4 border-t border-edge">
            {!address ? (
              <div className="p-4 bg-elevated border border-edge rounded-xl">
                <p className="text-dim text-sm">Connect your wallet to interact with this deal.</p>
              </div>
            ) : !accountState ? (
              <div className="p-4 bg-elevated border border-edge rounded-xl">
                <p className="text-dim text-sm">Loading account...</p>
              </div>
            ) : (
              <div className="flex gap-3">
                {canAccept && (
                  <button onClick={handleAcceptDeal} disabled={processing} className="btn-silver">
                    {processing ? 'Processing...' : 'Accept Deal'}
                  </button>
                )}
                {isMaker && deal.status === 'Pending' && (
                  <button onClick={handleCancelDeal} disabled={processing} className="btn-danger">
                    {processing ? 'Processing...' : 'Cancel Deal'}
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
