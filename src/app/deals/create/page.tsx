'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import { api } from '@/services/api'
import { useWallet } from '@/hooks/useWallet'
import { ethers } from 'ethers'
import { parseAmount, signTransactionCorrect, formatAmount } from '@/utils/transactions'
import { parseWalletError } from '@/utils/walletErrors'
import { ASSETS, AVAILABLE_CHAINS, DEFAULTS, getVaultContract, getChainName } from '@/constants/config'

export default function CreateDeal() {
  const router = useRouter()
  const { address, accountState, loading: walletLoading, walletInstalled, refreshAccountState, switchToChain } = useWallet()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [dealId] = useState<string>(() => String(Date.now()))
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [taker, setTaker] = useState<string>('')
  const assetBase = ASSETS.ETH.id
  const assetQuote = ASSETS.ETH.id
  const [chainIdBase, setChainIdBase] = useState<string>(String(DEFAULTS.CHAIN_BASE))
  const [chainIdQuote, setChainIdQuote] = useState<string>(String(DEFAULTS.CHAIN_QUOTE))
  const [amountBase, setAmountBase] = useState<string>('')
  const [priceQuotePerBase, setPriceQuotePerBase] = useState<string>(DEFAULTS.PRICE_RATE)

  useEffect(() => {
    if (address && chainIdBase) {
      refreshAccountState()
    }
  }, [chainIdBase]) // eslint-disable-line react-hooks/exhaustive-deps

  const getCurrentBalance = (): bigint => {
    if (!accountState) return BigInt(0)
    const chainIdBaseNum = parseInt(chainIdBase)
    const balance = accountState.balances.find(
      (b) => b.asset_id === assetBase && b.chain_id === chainIdBaseNum
    )
    return balance ? BigInt(balance.amount) : BigInt(0)
  }

  const isBalanceSufficient = (): boolean => {
    if (!amountBase) return false
    const required = parseAmount(amountBase)
    const current = getCurrentBalance()
    return current >= required
  }

  const validate = (): string | null => {
    if (!address) return 'Please connect your wallet to create a deal.'
    if (!accountState) return 'Account is still loading. Please wait a moment.'
    if (!amountBase || parseAmount(amountBase) === BigInt(0)) return 'Please enter a valid amount.'
    if (!priceQuotePerBase) return 'Please enter an exchange rate.'
    if (visibility === 'private' && (!taker || !ethers.isAddress(taker))) {
      return 'Please enter a valid taker address for private deals.'
    }
    return null
  }

  const handleDepositAndCreateDeal = async () => {
    if (!address || !window.ethereum || !accountState) return

    setLoading(true)
    setError(null)

    try {
      const chainIdBaseNum = parseInt(chainIdBase)

      const switched = await switchToChain(chainIdBaseNum)
      if (!switched) {
        setError(`Please switch to ${getChainName(chainIdBaseNum)} in your wallet to proceed.`)
        setLoading(false)
        return
      }

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const vaultContract = getVaultContract(chainIdBaseNum)

      if (!vaultContract || !ethers.isAddress(vaultContract)) {
        setError(`Vault contract not configured for ${getChainName(chainIdBaseNum)}.`)
        setLoading(false)
        return
      }

      const contract = new ethers.Contract(
        vaultContract,
        [
          'function deposit(uint256 assetId, uint256 amount) external',
          'function depositNative(uint256 assetId) external payable',
        ],
        signer
      )

      const amountWei = parseAmount(amountBase)
      const tx = await contract.depositNative(assetBase, { value: amountWei })
      const receipt = await tx.wait()
      const txHash = receipt.hash

      let nonce = accountState.nonce
      const depositPayload = {
        txHash: txHash,
        account: address,
        assetId: assetBase,
        amount: amountWei.toString(),
        chainId: chainIdBaseNum,
      }

      const depositSignature = await signTransactionCorrect(signer, address, nonce, 'Deposit', depositPayload)
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

      const expectedNonce = nonce + 1
      for (let attempt = 0; attempt < 15; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        const state = await api.getAccountState(address)
        if (state.nonce >= expectedNonce) {
          nonce = state.nonce
          break
        }
        if (attempt === 14) {
          throw new Error('Deposit is taking longer than expected. Please try again.')
        }
      }
      await refreshAccountState()

      const dealIdNum = parseInt(dealId)
      const chainIdQuoteNum = parseInt(chainIdQuote)
      const amountBaseBigInt = parseAmount(amountBase)
      const priceBigInt = BigInt(Math.floor(Number(priceQuotePerBase) || 1))

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

      const dealSignature = await signTransactionCorrect(signer, address, nonce, 'CreateDeal', dealPayload)
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

      await api.submitTransaction(dealRequest)
      await refreshAccountState()
      await new Promise(resolve => setTimeout(resolve, 1500))
      router.push(`/deals/${dealId}`)
    } catch (err: any) {
      setError(parseWalletError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleCreateDeal = async () => {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    const needsDeposit = !isBalanceSufficient()
    if (needsDeposit) {
      const required = formatAmount(parseAmount(amountBase))
      const current = formatAmount(getCurrentBalance())
      const chainName = getChainName(parseInt(chainIdBase))
      setError(
        `Insufficient balance: ${current} ETH available on ${chainName}, but ${required} ETH required. ` +
        `A deposit will be made automatically before creating the deal.`
      )
      await handleDepositAndCreateDeal()
      return
    }

    setLoading(true)
    setError(null)

    try {
      const provider = new ethers.BrowserProvider(window.ethereum!)
      const signer = await provider.getSigner()
      const dealIdNum = parseInt(dealId)
      const chainIdBaseNum = parseInt(chainIdBase)
      const chainIdQuoteNum = parseInt(chainIdQuote)
      const amountBaseBigInt = parseAmount(amountBase)
      const priceBigInt = BigInt(Math.floor(Number(priceQuotePerBase) || 1))

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

      const nonce = accountState!.nonce
      const signature = await signTransactionCorrect(signer, address!, nonce, 'CreateDeal', payload)

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

      await api.submitTransaction(submitRequest)
      await refreshAccountState()
      await new Promise(resolve => setTimeout(resolve, 1500))
      router.push(`/deals/${dealId}`)
    } catch (err: any) {
      setError(parseWalletError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-xl mx-auto">
        <div className="mb-10">
          <h1 className="font-heading text-3xl font-bold text-bright tracking-tight">New Deal</h1>
          <p className="text-sm text-dim mt-1.5">Create a cross-chain settlement deal</p>
        </div>

        {!walletInstalled ? (
          <div className="bg-surface rounded-2xl p-10 text-center space-y-4 shadow-elevation-1">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-warning/10 flex items-center justify-center">
              <span className="text-warning text-2xl">!</span>
            </div>
            <p className="text-bright font-heading font-semibold text-lg">No wallet detected</p>
            <p className="text-dim text-sm">
              Install MetaMask or another Web3 wallet to use Axync.
            </p>
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline inline-block text-sm mt-2"
            >
              Install MetaMask
            </a>
          </div>
        ) : !address ? (
          <div className="bg-surface rounded-2xl p-10 text-center space-y-4 shadow-elevation-1">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-elevated flex items-center justify-center">
              <span className="text-dim text-2xl">&#x1F50C;</span>
            </div>
            <p className="text-bright font-heading font-semibold text-lg">Wallet not connected</p>
            <p className="text-dim text-sm">
              Click &quot;Connect Wallet&quot; in the top right to create a deal.
            </p>
          </div>
        ) : (
          <div className="bg-surface rounded-2xl p-8 shadow-elevation-1">
            {error && (
              <div className="mb-8 p-4 bg-danger/5 rounded-xl flex items-start gap-3">
                <span className="text-danger text-sm mt-0.5 shrink-0">&#x26A0;</span>
                <div className="flex-1">
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

            <div className="space-y-6">
              {/* Visibility */}
              <div>
                <label className="block text-sm font-medium text-dim mb-2">
                  Visibility
                </label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}
                >
                  <option value="public">Public</option>
                  <option value="private">Direct (Private)</option>
                </select>
              </div>

              {visibility === 'private' && (
                <div>
                  <label className="block text-sm font-medium text-dim mb-2">
                    Taker Address
                  </label>
                  <input
                    type="text"
                    value={taker}
                    onChange={(e) => setTaker(e.target.value)}
                    placeholder="0x..."
                    className="font-mono"
                  />
                  {taker && !ethers.isAddress(taker) && (
                    <p className="text-warning text-xs mt-2">Invalid address format</p>
                  )}
                </div>
              )}

              {/* Chains */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dim mb-2">
                    From Chain
                  </label>
                  <select value={chainIdBase} onChange={(e) => setChainIdBase(e.target.value)}>
                    {AVAILABLE_CHAINS.map((chain) => (
                      <option key={chain.id} value={chain.id}>{chain.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dim mb-2">
                    To Chain
                  </label>
                  <select value={chainIdQuote} onChange={(e) => setChainIdQuote(e.target.value)}>
                    {AVAILABLE_CHAINS.map((chain) => (
                      <option key={chain.id} value={chain.id}>{chain.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-dim mb-2">
                  Amount ({ASSETS.ETH.symbol})
                </label>
                <input
                  type="text"
                  value={amountBase}
                  onChange={(e) => setAmountBase(e.target.value)}
                  placeholder="0.0"
                />
                {accountState && amountBase && (
                  <div className="mt-2.5">
                    {isBalanceSufficient() ? (
                      <span className="text-success text-xs">
                        Balance: {formatAmount(getCurrentBalance())} available on {getChainName(parseInt(chainIdBase))}
                      </span>
                    ) : (
                      <span className="text-warning text-xs">
                        {formatAmount(getCurrentBalance())} available on {getChainName(parseInt(chainIdBase))}. Deposit will be made automatically.
                      </span>
                    )}
                  </div>
                )}
                {walletLoading && !accountState && (
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="w-3 h-3 border border-dim border-t-transparent rounded-full animate-spin" />
                    <span className="text-dim text-xs">Loading balance...</span>
                  </div>
                )}
              </div>

              {/* Rate */}
              <div>
                <label className="block text-sm font-medium text-dim mb-2">
                  Exchange Rate (multiplier)
                </label>
                <input
                  type="text"
                  value={priceQuotePerBase}
                  onChange={(e) => setPriceQuotePerBase(e.target.value)}
                  placeholder="1"
                />
                {amountBase && priceQuotePerBase && (
                  <p className="text-dim text-xs mt-2">
                    Taker pays: {(parseFloat(amountBase || '0') * parseFloat(priceQuotePerBase || '1')).toFixed(6)} ETH on {getChainName(parseInt(chainIdQuote))}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => router.back()}
                  className="btn-outline flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateDeal}
                  disabled={loading}
                  className="btn-silver flex-1"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-base border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </span>
                  ) : (
                    'Create Deal'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
