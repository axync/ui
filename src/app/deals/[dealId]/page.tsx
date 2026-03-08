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
      console.error('Error loading deal:', err)
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

    if (dealId) {
      loadDeal()
    }
  }, [dealId, loadDeal])

  // Debug logging for Accept button
  useEffect(() => {
    if (deal && address) {
      const isMakerDebug = deal.maker.toLowerCase() === address?.toLowerCase()
      const canAcceptDebug = !isMakerDebug && deal.status?.toLowerCase() === 'pending' && address && accountState
      console.log('Deal details for Accept button:', {
        dealMaker: deal.maker,
        currentAddress: address,
        isMaker: isMakerDebug,
        dealStatus: deal.status,
        hasAccountState: !!accountState,
        canAccept: canAcceptDebug,
      })
    }
  }, [deal, address, accountState])

  const handleAcceptDeal = async () => {
    if (!address || !window.ethereum || !accountState || !deal) {
      alert('Please connect your wallet and wait for account to load')
      return
    }

    // Check if user has sufficient balance for the quote asset on quote chain
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
      const requiredAmount = (amountQuote / BigInt(10 ** 18)).toString()
      const currentAmount = (currentBalance / BigInt(10 ** 18)).toString()
      setError(
        `Insufficient balance! You need ${requiredAmount} ETH on ${chainName} (chain ${deal.chain_id_quote}) to accept this deal. ` +
        `You currently have ${currentAmount} ETH. ` +
        `Please make a deposit first on the ${chainName} network.`
      )
      return
    }

    setProcessing(true)
    setError(null)

    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()

      const nonce = accountState.nonce
      const payload = {
        dealId: deal.deal_id,
        amount: null, // Accept full amount
      }

      const signature = await signTransactionCorrect(
        signer,
        address,
        nonce,
        'AcceptDeal',
        payload
      )

      const submitRequest = {
        kind: 'AcceptDeal',
        from: address,
        deal_id: deal.deal_id,
        amount: null,
        nonce: nonce,
        signature: signature,
      }

      const result = await api.submitTransaction(submitRequest)
      alert(`Deal accepted successfully!\nTransaction Hash: ${result.tx_hash}`)

      // Reload deal and account state
      await loadDeal()
      await loadAccountState(address)
    } catch (err: any) {
      setError(err.message || 'Failed to accept deal')
      console.error('Error accepting deal:', err)
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

    if (!confirm('Are you sure you want to cancel this deal?')) {
      return
    }

    setProcessing(true)
    setError(null)

    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()

      const nonce = accountState.nonce
      const payload = {
        dealId: deal.deal_id,
      }

      const signature = await signTransactionCorrect(
        signer,
        address,
        nonce,
        'CancelDeal',
        payload
      )

      const submitRequest = {
        kind: 'CancelDeal',
        from: address,
        deal_id: deal.deal_id,
        nonce: nonce,
        signature: signature,
      }

      const result = await api.submitTransaction(submitRequest)
      alert(`Deal cancelled successfully!\nTransaction Hash: ${result.tx_hash}`)

      // Reload deal and account state
      await loadDeal()
      await loadAccountState(address)
    } catch (err: any) {
      setError(err.message || 'Failed to cancel deal')
      console.error('Error cancelling deal:', err)
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="px-4 py-8">
          <p className="text-gray-600">Loading deal details...</p>
        </div>
      </Layout>
    )
  }

  if (error || !deal) {
    return (
      <Layout>
        <div className="px-4 py-8">
          <div className="bg-red-50 rounded-lg shadow p-6">
            <p className="text-red-600">
              {error || 'Deal not found'}
            </p>
          </div>
        </div>
      </Layout>
    )
  }

  // Recalculate these values on every render to ensure they update when dependencies change
  const isMaker = deal?.maker?.toLowerCase() === address?.toLowerCase()
  
  // Debug: Check each condition separately
  // Note: Backend returns status with capital letter (e.g., "Pending"), so we use case-insensitive comparison
  const condition1 = !isMaker
  const condition2 = deal?.status?.toLowerCase() === 'pending'
  const condition3 = !!address
  const condition4 = !!accountState
  
  const canAccept = condition1 && condition2 && condition3 && condition4

  // Debug: Log current state with detailed conditions
  console.log('Render state (detailed):', {
    hasDeal: !!deal,
    dealMaker: deal?.maker,
    currentAddress: address,
    isMaker,
    condition1_notIsMaker: condition1,
    condition2_statusPending: condition2,
    dealStatus: deal?.status,
    condition3_hasAddress: condition3,
    condition4_hasAccountState: condition4,
    accountState: accountState,
    canAccept,
  })

  return (
    <Layout>
      <div className="px-4 py-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-primary-600 hover:text-primary-700 mb-4"
          >
            ← Back to Deals
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            Deal #{deal.deal_id}
          </h1>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* Status */}
          <div className="flex justify-between items-center">
            <span
              className={`px-3 py-1 text-sm rounded ${
                deal.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : deal.status === 'completed'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {deal.status}
            </span>
            {deal.visibility === 'private' && (
              <span className="px-3 py-1 text-sm bg-purple-100 text-purple-800 rounded">
                Private
              </span>
            )}
          </div>

          {/* Deal Details */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Maker</h3>
              <p className="font-mono text-sm text-gray-900">{formatAddress(deal.maker)}</p>
            </div>
            {deal.taker && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">
                  Taker
                </h3>
                <p className="font-mono text-sm text-gray-900">{formatAddress(deal.taker)}</p>
              </div>
            )}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                Base Asset
              </h3>
              <p className="text-gray-900">ID: {deal.asset_base}</p>
              <p className="text-xs text-gray-500">
                Chain: {deal.chain_id_base}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                Quote Asset
              </h3>
              <p className="text-gray-900">ID: {deal.asset_quote}</p>
              <p className="text-xs text-gray-500">
                Chain: {deal.chain_id_quote}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                Amount (Base)
              </h3>
              <p className="text-lg font-semibold text-gray-900">
                {formatAmount(BigInt(deal.amount_base))}
              </p>
              {deal.amount_remaining && (
                <p className="text-xs text-gray-500">
                  Remaining: {formatAmount(BigInt(deal.amount_remaining))}
                </p>
              )}
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Price</h3>
              <p className="text-lg font-semibold text-gray-900">
                {formatAmount(BigInt(deal.price_quote_per_base))} per base
              </p>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="pt-4 border-t">
            {!address ? (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-blue-800 mb-2">
                  <strong>Connect your wallet</strong> to accept this deal.
                </p>
                <p className="text-sm text-blue-600">
                  Use the &quot;Connect Wallet&quot; button in the header to connect your MetaMask wallet.
                </p>
              </div>
            ) : !accountState ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-yellow-800 mb-2">
                  <strong>Loading account...</strong>
                </p>
                <p className="text-sm text-yellow-600">
                  Please wait while we load your account information.
                </p>
              </div>
            ) : (
              <div className="flex flex-col space-y-4">
                {/* Debug info */}
                <div className="p-2 bg-gray-100 rounded text-xs text-gray-600 space-y-1">
                  <div><strong>Debug:</strong></div>
                  <div>canAccept: {canAccept ? 'true' : 'false'}</div>
                  <div>isMaker: {isMaker ? 'true' : 'false'}</div>
                  <div>!isMaker: {!isMaker ? 'true' : 'false'}</div>
                  <div>status: {deal?.status || 'undefined'}</div>
                  <div>status === &apos;pending&apos;: {(deal?.status === 'pending') ? 'true' : 'false'}</div>
                  <div>hasAddress: {address ? 'yes' : 'no'}</div>
                  <div>hasAccountState: {accountState ? 'yes' : 'no'}</div>
                  <div>deal?.maker: {deal?.maker || 'undefined'}</div>
                  <div>address: {address || 'undefined'}</div>
                  <div>condition1 (!isMaker): {condition1 ? 'true' : 'false'}</div>
                  <div>condition2 (status pending): {condition2 ? 'true' : 'false'}</div>
                  <div>condition3 (hasAddress): {condition3 ? 'true' : 'false'}</div>
                  <div>condition4 (hasAccountState): {condition4 ? 'true' : 'false'}</div>
                </div>
                
                <div className="flex space-x-4">
                  {canAccept && (
                    <button
                      onClick={handleAcceptDeal}
                      disabled={processing}
                      className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                    >
                      {processing ? 'Processing...' : 'Accept Deal'}
                    </button>
                  )}
                  {isMaker && deal.status?.toLowerCase() === 'pending' && (
                    <button
                      onClick={handleCancelDeal}
                      disabled={processing}
                      className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                    >
                      {processing ? 'Processing...' : 'Cancel Deal'}
                    </button>
                  )}
                  {!canAccept && !isMaker && deal.status?.toLowerCase() === 'pending' && (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
                      <p className="text-gray-800 mb-1">
                        <strong>Cannot accept this deal</strong>
                      </p>
                      <p className="text-sm text-gray-600">
                        Debug: isMaker={isMaker ? 'true' : 'false'}, status={deal.status}, hasAddress={address ? 'yes' : 'no'}, hasAccountState={accountState ? 'yes' : 'no'}
                      </p>
                    </div>
                  )}
                  {!canAccept && isMaker && (
                    <p className="text-gray-600 py-2">
                      You created this deal. You can cancel it if it&apos;s still pending.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
