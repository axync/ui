'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import { api, AccountState } from '@/services/api'
import { ethers } from 'ethers'
import { parseAmount, signTransactionCorrect, formatAmount } from '@/utils/transactions'
import { ASSETS, AVAILABLE_CHAINS, DEFAULTS, getDepositContract, getChainName, getChainHex } from '@/constants/config'

function parseErrorMessage(err: any): string {
  const msg = err?.message || err?.reason || 'Unknown error'
  if (msg.includes('INSUFFICIENT_FUNDS') || msg.includes('insufficient funds')) {
    return 'Insufficient funds in your wallet. Please add Sepolia ETH and try again.'
  }
  if (msg.includes('user rejected') || msg.includes('ACTION_REJECTED') || err?.code === 4001) {
    return 'Transaction rejected by user.'
  }
  if (msg.includes('nonce')) {
    return 'Transaction nonce error. Please try again.'
  }
  // Strip long hex/technical data
  const clean = msg.replace(/\(transaction=\{.*?\}\)/s, '').replace(/\(action=.*?\)/s, '').trim()
  return clean.length > 200 ? clean.slice(0, 200) + '...' : clean
}

export default function CreateDeal() {
  const router = useRouter()
  const [address, setAddress] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accountState, setAccountState] = useState<AccountState | null>(null)

  const [dealId] = useState<string>(() => String(Date.now()))
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [taker, setTaker] = useState<string>('')
  const assetBase = ASSETS.ETH.id
  const assetQuote = ASSETS.ETH.id
  const [chainIdBase, setChainIdBase] = useState<string>(String(DEFAULTS.CHAIN_BASE))
  const [chainIdQuote, setChainIdQuote] = useState<string>(String(DEFAULTS.CHAIN_QUOTE))
  const [amountBase, setAmountBase] = useState<string>('')
  const [priceQuotePerBase, setPriceQuotePerBase] = useState<string>(DEFAULTS.PRICE_RATE)

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
  }, [loadAccountState])

  useEffect(() => {
    if (address && chainIdBase) {
      loadAccountState(address)
    }
  }, [chainIdBase, address, loadAccountState])

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

  const switchToChain = async (targetChainId: number) => {
    if (!window.ethereum) return
    const hexChainId = getChainHex(targetChainId)
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }],
      })
    } catch (switchError: any) {
      // Chain not added — try to add it
      if (switchError.code === 4902) {
        const chainInfo: Record<number, any> = {
          11155111: {
            chainId: hexChainId,
            chainName: 'Ethereum Sepolia',
            rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com'],
            nativeCurrency: { name: 'SepoliaETH', symbol: 'ETH', decimals: 18 },
            blockExplorerUrls: ['https://sepolia.etherscan.io'],
          },
          84532: {
            chainId: hexChainId,
            chainName: 'Base Sepolia',
            rpcUrls: ['https://sepolia.base.org'],
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            blockExplorerUrls: ['https://sepolia.basescan.org'],
          },
        }
        if (chainInfo[targetChainId]) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [chainInfo[targetChainId]],
          })
        }
      } else {
        throw switchError
      }
    }
  }

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
      const chainIdBaseNum = parseInt(chainIdBase)
      await switchToChain(chainIdBaseNum)

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
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

      await new Promise(resolve => setTimeout(resolve, 2000))
      await loadAccountState(address)
      const updatedState = await api.getAccountState(address)
      nonce = updatedState.nonce

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
      await loadAccountState(address)
      router.push(`/deals/${dealId}`)
    } catch (err: any) {
      setError(parseErrorMessage(err))
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

    const needsDeposit = !isBalanceSufficient()
    if (needsDeposit) {
      const required = formatAmount(parseAmount(amountBase))
      const current = formatAmount(getCurrentBalance())
      const chainName = getChainName(parseInt(chainIdBase))
      if (!confirm(
        `Insufficient balance!\n\nRequired: ${required} ${ASSETS.ETH.symbol}\nCurrent: ${current} ${ASSETS.ETH.symbol} on ${chainName}\n\nWe will deposit ${required} ${ASSETS.ETH.symbol} and create the deal in one transaction. Continue?`
      )) {
        return
      }
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

      const nonce = accountState.nonce
      const signature = await signTransactionCorrect(signer, address, nonce, 'CreateDeal', payload)

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
      await loadAccountState(address)
      router.push(`/deals/${dealId}`)
    } catch (err: any) {
      setError(parseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-xl mx-auto">
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-bold text-bright">New Deal</h1>
          <p className="text-sm text-dim mt-1">Create a cross-chain settlement deal</p>
        </div>

        {!address ? (
          <div className="bg-surface border border-edge rounded-2xl p-8 text-center">
            <p className="text-dim">Connect your wallet to create a deal</p>
          </div>
        ) : (
          <div className="bg-surface border border-edge rounded-2xl p-6">
            {error && (
              <div className="mb-6 p-4 bg-danger/5 border border-danger/20 rounded-xl">
                <p className="text-danger text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-5">
              {/* Visibility */}
              <div>
                <label className="block font-mono text-[10px] tracking-[2px] uppercase text-silver-lo mb-2">
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
                  <label className="block font-mono text-[10px] tracking-[2px] uppercase text-silver-lo mb-2">
                    Taker Address
                  </label>
                  <input
                    type="text"
                    value={taker}
                    onChange={(e) => setTaker(e.target.value)}
                    placeholder="0x..."
                  />
                </div>
              )}

              {/* Chains */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[10px] tracking-[2px] uppercase text-silver-lo mb-2">
                    From Chain
                  </label>
                  <select value={chainIdBase} onChange={(e) => setChainIdBase(e.target.value)}>
                    {AVAILABLE_CHAINS.map((chain) => (
                      <option key={chain.id} value={chain.id}>{chain.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-[10px] tracking-[2px] uppercase text-silver-lo mb-2">
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
                <label className="block font-mono text-[10px] tracking-[2px] uppercase text-silver-lo mb-2">
                  Amount ({ASSETS.ETH.symbol})
                </label>
                <input
                  type="text"
                  value={amountBase}
                  onChange={(e) => setAmountBase(e.target.value)}
                  placeholder="0.0"
                />
                {accountState && amountBase && (
                  <div className="mt-2">
                    {isBalanceSufficient() ? (
                      <span className="text-success text-xs font-mono">
                        Balance: {formatAmount(getCurrentBalance())} available
                      </span>
                    ) : (
                      <span className="text-warning text-xs font-mono">
                        Insufficient: {formatAmount(getCurrentBalance())} available. Deposit will be made automatically.
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Rate */}
              <div>
                <label className="block font-mono text-[10px] tracking-[2px] uppercase text-silver-lo mb-2">
                  Exchange Rate (multiplier)
                </label>
                <input
                  type="text"
                  value={priceQuotePerBase}
                  onChange={(e) => setPriceQuotePerBase(e.target.value)}
                  placeholder="1"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
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
