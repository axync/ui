'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import { api, AccountState } from '@/services/api'
import { ethers } from 'ethers'
import { parseAmount, signTransactionCorrect, formatAmount } from '@/utils/transactions'
import { ASSETS, AVAILABLE_CHAINS, DEFAULTS, getDepositContract, getChainName } from '@/constants/config'

export default function CreateDeal() {
  const router = useRouter()
  const [address, setAddress] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accountState, setAccountState] = useState<AccountState | null>(null)

  // Form fields
  // Deal ID is auto-generated, not shown to user
  const [dealId] = useState<string>(() => String(Date.now()))
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [taker, setTaker] = useState<string>('')
  // Fixed: Only ETH is supported
  const assetBase = ASSETS.ETH.id
  const assetQuote = ASSETS.ETH.id
  const [chainIdBase, setChainIdBase] = useState<string>(String(DEFAULTS.CHAIN_BASE))
  const [chainIdQuote, setChainIdQuote] = useState<string>(String(DEFAULTS.CHAIN_QUOTE))
  const [amountBase, setAmountBase] = useState<string>('')
  const [priceQuotePerBase, setPriceQuotePerBase] = useState<string>(DEFAULTS.PRICE_RATE)

  // Define loadAccountState before using it in useEffect
  const loadAccountState = useCallback(async (addr: string) => {
    try {
      const state = await api.getAccountState(addr)
      setAccountState(state)
    } catch (err) {
      console.error('Error loading account state:', err)
    }
  }, [])

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

    // No need to fetch chains - we only support 2 testnets
  }, [loadAccountState])

  // Reload account state when chain_id_base changes to update balance display
  useEffect(() => {
    if (address && chainIdBase) {
      loadAccountState(address)
    }
  }, [chainIdBase, address, loadAccountState])

  // Get current balance for ETH on chain_id_base
  const getCurrentBalance = (): bigint => {
    if (!accountState) return BigInt(0)
    const chainIdBaseNum = parseInt(chainIdBase)
    
    const balance = accountState.balances.find(
      (b) => b.asset_id === assetBase && b.chain_id === chainIdBaseNum
    )
    return balance ? BigInt(balance.amount) : BigInt(0)
  }

  // Check if balance is sufficient
  const isBalanceSufficient = (): boolean => {
    if (!amountBase) return false
    const required = parseAmount(amountBase)
    const current = getCurrentBalance()
    return current >= required
  }

  // Auto-deposit function
  const handleAutoDeposit = async () => {
    if (!address || !window.ethereum || !accountState) {
      alert('Please connect your wallet')
      return
    }

    if (!amountBase || parseFloat(amountBase) <= 0) {
      alert('Please enter a valid amount')
      return
    }

    const chainIdBaseNum = parseInt(chainIdBase)
    const depositContract = getDepositContract(chainIdBaseNum)
    
    if (!depositContract || !ethers.isAddress(depositContract)) {
      alert(`Deposit contract not configured for chain ${chainIdBaseNum}`)
      return
    }

    setDepositing(true)
    setError(null)

    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(
        depositContract,
        [
          'function deposit(uint256 assetId, uint256 amount) external',
          'function depositNative(uint256 assetId) external payable',
        ],
        signer
      )

      const amountWei = parseAmount(amountBase)

      // Step 1: Call depositNative for ETH (native currency)
      // Note: Contract requires assetId > 0, but for native ETH we use depositNative
      // The assetId in the system is 1, but for native deposits we can use 1 or any > 0
      const tx = await contract.depositNative(assetBase, { value: amountWei })
      const receipt = await tx.wait()

      // Step 2: Get tx_hash from receipt
      const txHash = receipt.hash

      // Step 3: Create and sign deposit transaction for sequencer
      const nonce = accountState.nonce
      const payload = {
        txHash: txHash,
        account: address,
        assetId: assetBase,
        amount: amountWei.toString(),
        chainId: chainIdBaseNum,
      }

      const signature = await signTransactionCorrect(
        signer,
        address,
        nonce,
        'Deposit',
        payload
      )

      // Step 4: Submit transaction to sequencer
      const submitRequest = {
        kind: 'Deposit',
        tx_hash: txHash,
        account: address,
        asset_id: assetBase,
        amount: amountWei.toString(),
        chain_id: chainIdBaseNum,
        nonce: nonce,
        signature: signature,
      }

      const result = await api.submitTransaction(submitRequest)
      
      alert(`Deposit submitted successfully!\nTransaction Hash: ${result.tx_hash}\n\nPlease wait for the transaction to be processed, then try creating the deal again.`)

      // Reload account state
      await loadAccountState(address)
    } catch (err: any) {
      setError(err.message || 'Failed to process deposit')
      console.error('Error processing deposit:', err)
    } finally {
      setLoading(false)
    }
  }

  // Combined deposit + create deal in one flow
  const handleDepositAndCreateDeal = async () => {
    if (!address || !window.ethereum || !accountState) {
      alert('Please connect your wallet')
      return
    }

    if (!amountBase || !priceQuotePerBase) {
      alert('Please fill in all required fields')
      return
    }

    if (visibility === 'private' && (!taker || !ethers.isAddress(taker))) {
      alert('Please specify a valid taker address for private deals')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()

      const chainIdBaseNum = parseInt(chainIdBase)
      const depositContract = getDepositContract(chainIdBaseNum)
      
      if (!depositContract || !ethers.isAddress(depositContract)) {
        alert(`Deposit contract not configured for chain ${chainIdBaseNum}`)
        return
      }

      const contract = new ethers.Contract(
        depositContract,
        [
          'function deposit(uint256 assetId, uint256 amount) external',
          'function depositNative(uint256 assetId) external payable',
        ],
        signer
      )

      const amountWei = parseAmount(amountBase)

      // Step 1: Call depositNative for ETH (native currency)
      // User signs this - ONE transaction
      const tx = await contract.depositNative(assetBase, { value: amountWei })
      const receipt = await tx.wait()
      const txHash = receipt.hash

      // Step 2: Create and sign deposit transaction for sequencer
      let nonce = accountState.nonce
      const depositPayload = {
        txHash: txHash,
        account: address,
        assetId: assetBase,
        amount: amountWei.toString(),
        chainId: chainIdBaseNum,
      }

      const depositSignature = await signTransactionCorrect(
        signer,
        address,
        nonce,
        'Deposit',
        depositPayload
      )

      // Step 3: Submit deposit transaction
      const depositRequest = {
        kind: 'Deposit',
        tx_hash: txHash,
        account: address,
        asset_id: assetBase,
        amount: amountWei.toString(),
        chain_id: chainIdBaseNum,
        nonce: nonce,
        signature: depositSignature,
      }

      await api.submitTransaction(depositRequest)

      // Step 4: Wait a bit and reload account state to get updated nonce
      await new Promise(resolve => setTimeout(resolve, 2000))
      await loadAccountState(address)
      const updatedState = await api.getAccountState(address)
      nonce = updatedState.nonce

      // Step 5: Create the deal (automatically, no user interaction needed)
      const dealIdNum = parseInt(dealId)
      const chainIdQuoteNum = parseInt(chainIdQuote)
      const amountBaseBigInt = parseAmount(amountBase)
      const priceBigInt = parseAmount(priceQuotePerBase)

      const dealPayload = {
        dealId: dealIdNum,
        visibility: visibility === 'public' ? 'Public' : 'Direct',
        taker: visibility === 'private' ? taker : null,
        assetBase: assetBase,
        assetQuote: assetQuote,
        chainIdBase: chainIdBaseNum,
        chainIdQuote: chainIdQuoteNum,
        amountBase: amountBaseBigInt.toString(),
        priceQuotePerBase: priceBigInt.toString(),
      }

      const dealSignature = await signTransactionCorrect(
        signer,
        address,
        nonce,
        'CreateDeal',
        dealPayload
      )

      const dealRequest = {
        kind: 'CreateDeal',
        from: address,
        deal_id: dealIdNum,
        visibility: visibility === 'public' ? 'Public' : 'Direct',
        taker: visibility === 'private' ? taker : null,
        asset_base: assetBase,
        asset_quote: assetQuote,
        chain_id_base: chainIdBaseNum,
        chain_id_quote: chainIdQuoteNum,
        amount_base: amountBaseBigInt.toString(),
        price_quote_per_base: priceBigInt.toString(),
        expires_at: null,
        external_ref: null,
        nonce: nonce,
        signature: dealSignature,
      }

      const result = await api.submitTransaction(dealRequest)
      alert(`✅ Deposit and deal created successfully!\nDeal Transaction Hash: ${result.tx_hash}`)

      // Reload account state
      await loadAccountState(address)

      // Redirect to deal details
      router.push(`/deals/${dealId}`)
    } catch (err: any) {
      setError(err.message || 'Failed to process deposit and create deal')
      console.error('Error processing deposit and create deal:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateDeal = async () => {
    if (!address || !window.ethereum) {
      alert('Please connect your wallet')
      return
    }

    if (!accountState) {
      alert('Please wait for account to load')
      return
    }

    if (!amountBase || !priceQuotePerBase) {
      alert('Please fill in all required fields')
      return
    }

    if (visibility === 'private' && (!taker || !ethers.isAddress(taker))) {
      alert('Please specify a valid taker address for private deals')
      return
    }

    // If balance is insufficient, combine deposit + create deal in one flow
    const needsDeposit = !isBalanceSufficient()
    
    if (needsDeposit) {
      const required = formatAmount(parseAmount(amountBase))
      const current = formatAmount(getCurrentBalance())
      const chainName = getChainName(parseInt(chainIdBase))
      
      if (!confirm(
        `Insufficient balance!\n\n` +
        `Required: ${required} ${ASSETS.ETH.symbol}\n` +
        `Current: ${current} ${ASSETS.ETH.symbol} on ${chainName}\n\n` +
        `We will deposit ${required} ${ASSETS.ETH.symbol} and create the deal in one transaction. Continue?`
      )) {
        return
      }
      
      // Combined deposit + create deal
      await handleDepositAndCreateDeal()
      return
    }

    setLoading(true)
    setError(null)

    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()

      const dealIdNum = parseInt(dealId)
      const chainIdBaseNum = parseInt(chainIdBase)
      const chainIdQuoteNum = parseInt(chainIdQuote)
      const amountBaseBigInt = parseAmount(amountBase)
      const priceBigInt = parseAmount(priceQuotePerBase)

      // Create transaction payload for signing
      const payload = {
        dealId: dealIdNum,
        visibility: visibility === 'public' ? 'Public' : 'Direct',
        taker: visibility === 'private' ? taker : null,
        assetBase: assetBase,
        assetQuote: assetQuote,
        chainIdBase: chainIdBaseNum,
        chainIdQuote: chainIdQuoteNum,
        amountBase: amountBaseBigInt.toString(),
        priceQuotePerBase: priceBigInt.toString(),
      }

      // Sign transaction
      const nonce = accountState.nonce
      const signature = await signTransactionCorrect(
        signer,
        address,
        nonce,
        'CreateDeal',
        payload
      )

      // Submit transaction
      const submitRequest = {
        kind: 'CreateDeal',
        from: address,
        deal_id: dealIdNum,
        visibility: visibility === 'public' ? 'Public' : 'Direct',
        taker: visibility === 'private' ? taker : null,
        asset_base: assetBase,
        asset_quote: assetQuote,
        chain_id_base: chainIdBaseNum,
        chain_id_quote: chainIdQuoteNum,
        amount_base: amountBaseBigInt.toString(),
        price_quote_per_base: priceBigInt.toString(),
        expires_at: null,
        external_ref: null,
        nonce: nonce,
        signature: signature,
      }

      const result = await api.submitTransaction(submitRequest)
      alert(`Deal created successfully!\nTransaction Hash: ${result.tx_hash}`)

      // Reload account state
      await loadAccountState(address)

      // Redirect to deal details
      router.push(`/deals/${dealId}`)
    } catch (err: any) {
      setError(err.message || 'Failed to create deal')
      console.error('Error creating deal:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="px-4 py-8 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Create Deal</h1>

        {!address ? (
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600">
              Please connect your wallet to create a deal
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-6">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-600">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Visibility
                </label>
                  <select
                  value={visibility}
                  onChange={(e) =>
                    setVisibility(e.target.value as 'public' | 'private')
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 bg-white"
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </div>

              {visibility === 'private' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Taker Address
                  </label>
                  <input
                    type="text"
                    value={taker}
                    onChange={(e) => setTaker(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From Chain
                  </label>
                  <select
                    value={chainIdBase}
                    onChange={(e) => setChainIdBase(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 bg-white"
                  >
                    {AVAILABLE_CHAINS.map((chain) => (
                      <option key={chain.id} value={chain.id}>
                        {chain.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    To Chain
                  </label>
                  <select
                    value={chainIdQuote}
                    onChange={(e) => setChainIdQuote(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 bg-white"
                  >
                    {AVAILABLE_CHAINS.map((chain) => (
                      <option key={chain.id} value={chain.id}>
                        {chain.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount ({ASSETS.ETH.symbol})
                </label>
                <input
                  type="text"
                  value={amountBase}
                  onChange={(e) => setAmountBase(e.target.value)}
                  placeholder="0.0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900"
                />
                {accountState && amountBase && (
                  <div className="mt-2 text-sm">
                    {isBalanceSufficient() ? (
                      <span className="text-green-600">
                        ✓ Balance sufficient: {formatAmount(getCurrentBalance())} available
                      </span>
                    ) : (
                      <span className="text-yellow-600">
                        ⚠ Insufficient balance: {formatAmount(getCurrentBalance())} available, {formatAmount(parseAmount(amountBase))} required. Deposit will be made automatically when creating the deal.
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Exchange Rate ({ASSETS.ETH.symbol} per {ASSETS.ETH.symbol})
                </label>
                <input
                  type="text"
                  value={priceQuotePerBase}
                  onChange={(e) => setPriceQuotePerBase(e.target.value)}
                  placeholder="1.0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900"
                />
              </div>

              <div className="flex space-x-4 pt-4">
                <button
                  onClick={() => router.back()}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateDeal}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Deal'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

