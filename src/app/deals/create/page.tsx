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
  const [settingsOpen, setSettingsOpen] = useState(false)

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

  const receiveAmount = amountBase && priceQuotePerBase
    ? (parseFloat(amountBase || '0') * parseFloat(priceQuotePerBase || '1')).toFixed(6)
    : '0'

  return (
    <Layout>
      <div className="max-w-[460px] mx-auto">
        <h2 className="text-lg font-bold text-center mb-5 fi">New Deal</h2>

        {!walletInstalled ? (
          <div className="card text-center !p-10 space-y-4">
            <div className="w-12 h-12 mx-auto rounded-xl bg-amber/10 flex items-center justify-center text-amber text-xl">!</div>
            <p className="text-tx font-semibold">No wallet detected</p>
            <p className="text-sm text-tx3">Install MetaMask or another Web3 wallet to use Axync.</p>
            <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm inline-flex">
              Install MetaMask
            </a>
          </div>
        ) : !address ? (
          <div className="card text-center !p-10 space-y-4">
            <div className="w-12 h-12 mx-auto rounded-xl bg-bg3 flex items-center justify-center text-tx3 text-xl">&#x1F50C;</div>
            <p className="text-tx font-semibold">Wallet not connected</p>
            <p className="text-sm text-tx3">Click &quot;Connect Wallet&quot; in the top right to create a deal.</p>
          </div>
        ) : (
          <div className="card fi1 !p-5">
            {error && (
              <div className="mb-4 p-3 bg-red/5 rounded-xl flex items-start gap-2.5 border border-red/10">
                <span className="text-red text-sm mt-0.5 shrink-0">&#x26A0;</span>
                <div className="flex-1">
                  <p className="text-red text-xs">{error}</p>
                  <button onClick={() => setError(null)} className="text-red/60 text-[10px] mt-1 hover:text-red font-medium">
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* YOU SEND */}
            <div className="p-3.5 rounded-xl bg-bg border border-brd mb-[-6px] relative z-[2]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-tx3 font-medium">You Send</span>
                <span className="text-[10px] text-tx3">
                  Balance: <span className="text-tx2 font-mono">{formatAmount(getCurrentBalance())} ETH</span>
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg border border-brd">
                  <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] font-bold bg-[rgba(98,126,234,0.15)] text-[#627EEA]">&Xi;</div>
                  <span className="text-[13px] font-semibold">ETH</span>
                </div>
                <input
                  type="text"
                  value={amountBase}
                  onChange={(e) => setAmountBase(e.target.value)}
                  placeholder="0.0"
                  className="flex-1 bg-transparent border-none outline-none text-right text-[22px] font-bold text-tx w-0"
                  style={{ padding: 0 }}
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex gap-[3px]">
                  {AVAILABLE_CHAINS.map((chain) => (
                    <button
                      key={chain.id}
                      onClick={() => setChainIdBase(String(chain.id))}
                      className={`flex items-center gap-[5px] py-[3px] px-[7px] rounded-[5px] border text-[9px] font-medium transition-all ${
                        String(chain.id) === chainIdBase
                          ? 'border-lav/30 bg-lav/[0.06] text-lav'
                          : 'border-brd text-tx2 hover:text-tx'
                      }`}
                    >
                      <span className="w-[5px] h-[5px] rounded-full" style={{ background: chain.id === 11155111 ? '#627EEA' : '#0052FF' }} />
                      {chain.name.replace(' Sepolia', '')}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1">
                  {['25%', '50%', 'MAX'].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => {
                        const bal = getCurrentBalance()
                        if (bal === BigInt(0)) return
                        const multiplier = pct === 'MAX' ? 1 : pct === '50%' ? 0.5 : 0.25
                        const amount = formatAmount(BigInt(Math.floor(Number(bal) * multiplier)))
                        setAmountBase(amount)
                      }}
                      className={`py-[2px] px-[6px] rounded text-[9px] font-medium border transition-all ${
                        pct === 'MAX'
                          ? 'border-lav/20 bg-lav/[0.06] text-lav font-semibold'
                          : 'border-brd bg-bg2 text-tx3 hover:text-tx2'
                      }`}
                    >
                      {pct}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Swap Arrow */}
            <div className="flex justify-center relative z-[3] h-0">
              <div
                className="w-9 h-9 rounded-[9px] bg-bg2 border border-brd flex items-center justify-center text-tx2 text-base cursor-pointer hover:border-lav/30 hover:text-lav transition-all"
                style={{ transform: 'translateY(-50%)' }}
              >
                &#8693;
              </div>
            </div>

            {/* YOU RECEIVE */}
            <div className="p-3.5 rounded-xl bg-bg border border-brd relative z-[1]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-tx3 font-medium">You Receive</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg border border-brd">
                  <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] font-bold bg-[rgba(98,126,234,0.15)] text-[#627EEA]">&Xi;</div>
                  <span className="text-[13px] font-semibold">ETH</span>
                </div>
                <div className="flex-1 text-right text-[22px] font-bold text-tx">
                  {receiveAmount}
                </div>
              </div>
              <div className="mt-2">
                <div className="flex gap-[3px]">
                  {AVAILABLE_CHAINS.map((chain) => (
                    <button
                      key={chain.id}
                      onClick={() => setChainIdQuote(String(chain.id))}
                      className={`flex items-center gap-[5px] py-[3px] px-[7px] rounded-[5px] border text-[9px] font-medium transition-all ${
                        String(chain.id) === chainIdQuote
                          ? 'border-lav/30 bg-lav/[0.06] text-lav'
                          : 'border-brd text-tx2 hover:text-tx'
                      }`}
                    >
                      <span className="w-[5px] h-[5px] rounded-full" style={{ background: chain.id === 11155111 ? '#627EEA' : '#0052FF' }} />
                      {chain.name.replace(' Sepolia', '')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Rate */}
            <div className="flex justify-between py-2.5 mt-2.5 border-t border-brd">
              <span className="text-[11px] text-tx3">Rate</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={priceQuotePerBase}
                  onChange={(e) => setPriceQuotePerBase(e.target.value)}
                  className="w-12 bg-transparent border-none outline-none text-right text-[11px] text-tx2 font-mono"
                  style={{ padding: 0 }}
                />
                <span className="text-[11px] text-tx2 font-mono">: 1</span>
              </div>
            </div>

            {/* Deal Settings */}
            <div className="border-t border-brd pt-2.5">
              <button
                onClick={() => setSettingsOpen(!settingsOpen)}
                className="flex items-center justify-between w-full"
              >
                <span className="text-[11px] text-tx2 font-medium">Deal Settings</span>
                <span className="text-[9px] text-tx3">{settingsOpen ? '▲' : '▼'}</span>
              </button>
              {settingsOpen && (
                <div className="pt-2.5 space-y-2.5">
                  <div>
                    <div className="text-[10px] text-tx3 mb-1.5">Counterparty (optional)</div>
                    <input
                      type="text"
                      value={taker}
                      onChange={(e) => setTaker(e.target.value)}
                      placeholder="0x... or ENS"
                      className="form-input !py-1.5 !px-2.5 !text-[11px] !rounded-lg font-mono"
                    />
                    {taker && !ethers.isAddress(taker) && (
                      <p className="text-amber text-[10px] mt-1">Invalid address</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <div className="text-[10px] text-tx3 mb-1.5">Visibility</div>
                      <select
                        value={visibility}
                        onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}
                        className="form-select !py-1.5 !px-2.5 !text-[11px] !rounded-lg"
                      >
                        <option value="public">Public</option>
                        <option value="private">Private</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-tx2">ZK Proof</span>
                      <span className="badge badge-lav" style={{ fontSize: '8px', padding: '1px 5px' }}>STARK&rarr;Groth16</span>
                    </div>
                    <div className="toggle on">
                      <div className="toggle-knob" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Summary */}
            {amountBase && (
              <div className="mt-2.5 p-2.5 px-3 rounded-[9px] bg-lav/[0.04] border border-lav/[0.08]">
                <div className="flex justify-between mb-0.5">
                  <span className="text-[10px] text-tx3">ZK Verification</span>
                  <span className="text-[10px] text-green">✓ Enabled</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-tx3">Route</span>
                  <span className="text-[10px] text-tx2">
                    {getChainName(parseInt(chainIdBase))} &rarr; {getChainName(parseInt(chainIdQuote))}
                  </span>
                </div>
                {!isBalanceSufficient() && amountBase && parseAmount(amountBase) > BigInt(0) && (
                  <div className="flex justify-between mt-0.5">
                    <span className="text-[10px] text-tx3">Auto-deposit</span>
                    <span className="text-[10px] text-amber">Required</span>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleCreateDeal}
              disabled={loading}
              className="btn btn-primary btn-lg w-full justify-center mt-3.5"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-bg border-t-transparent rounded-full animate-spin" />
                  Creating...
                </span>
              ) : (
                'Create Deal →'
              )}
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}
