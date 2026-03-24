'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ethers } from 'ethers'
import { useWallet } from '@/hooks/useWallet'
import { ESCROW_ABI, ERC20_ABI, ERC721_ABI } from '@/config/abis'
import { SUPPORTED_CHAIN_IDS, getContracts } from '@/config/contracts'

type AssetType = 'erc20' | 'erc721'
type Step = 'select' | 'price' | 'confirm'

const STEPS = [
  { key: 'select', label: 'Asset', num: 1 },
  { key: 'price', label: 'Price & Chain', num: 2 },
] as const

export default function CreateDealPage() {
  const router = useRouter()
  const { address } = useWallet()

  const [step, setStep] = useState<Step>('select')
  const [assetType, setAssetType] = useState<AssetType>('erc20')

  // Asset details
  const [tokenContract, setTokenContract] = useState('')
  const [tokenAmount, setTokenAmount] = useState('')
  const [tokenId, setTokenId] = useState('')
  const [tokenSymbol, setTokenSymbol] = useState('')
  const [tokenDecimals, setTokenDecimals] = useState(18)

  // Chain selection
  const [assetChainId, setAssetChainId] = useState(11155111)
  const [paymentChainId, setPaymentChainId] = useState(84532)

  // Price
  const [price, setPrice] = useState('')

  // State
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [txHash, setTxHash] = useState('')

  const assetChain = getContracts(assetChainId)
  const escrowAddress = assetChain?.escrow || ''

  async function lookupToken() {
    if (!tokenContract || !window.ethereum) return
    setError('')
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      if (assetType === 'erc20') {
        const token = new ethers.Contract(tokenContract, ERC20_ABI, provider)
        const [sym, dec, bal] = await Promise.all([
          token.symbol(),
          token.decimals(),
          token.balanceOf(address),
        ])
        setTokenSymbol(sym)
        setTokenDecimals(Number(dec))
        setTokenAmount(ethers.formatUnits(bal, dec))
      } else {
        const nft = new ethers.Contract(tokenContract, ERC721_ABI, provider)
        const sym = await nft.symbol()
        setTokenSymbol(sym)
      }
    } catch (e: any) {
      if (e?.code === 'UNCONFIGURED_NAME') {
        setError('Invalid contract address format.')
      } else {
        setError('Could not read contract. Make sure you are on the right network.')
      }
    }
  }

  async function handleList() {
    if (!address || !window.ethereum) return
    setLoading(true)
    setError('')

    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const escrow = new ethers.Contract(escrowAddress, ESCROW_ABI, signer)
      const priceWei = ethers.parseEther(price)

      if (assetType === 'erc20') {
        const amountWei = ethers.parseUnits(tokenAmount, tokenDecimals)

        // Approve
        const token = new ethers.Contract(tokenContract, ERC20_ABI, signer)
        const allowance = await token.allowance(address, escrowAddress)
        if (allowance < amountWei) {
          const approveTx = await token.approve(escrowAddress, amountWei)
          await approveTx.wait()
        }

        // List
        const tx = await escrow.listToken(tokenContract, amountWei, priceWei, paymentChainId)
        const receipt = await tx.wait()
        setTxHash(receipt.hash)
      } else {
        // Approve NFT
        const nft = new ethers.Contract(tokenContract, ERC721_ABI, signer)
        const approved = await nft.getApproved(tokenId)
        if (approved.toLowerCase() !== escrowAddress.toLowerCase()) {
          const approveTx = await nft.approve(escrowAddress, tokenId)
          await approveTx.wait()
        }

        // List
        const tx = await escrow.listNft(tokenContract, tokenId, priceWei, paymentChainId)
        const receipt = await tx.wait()
        setTxHash(receipt.hash)
      }

      setStep('confirm')
    } catch (e: any) {
      if (e.code === 4001 || e.code === 'ACTION_REJECTED') {
        setError('Transaction rejected')
      } else {
        setError(e.reason || e.shortMessage || 'Transaction failed')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!address) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card p-12 text-center space-y-3">
          <div className="text-3xl opacity-30">+</div>
          <p className="text-tx text-lg font-semibold">Connect Wallet</p>
          <p className="text-tx3 text-sm">Connect your wallet to create a deal</p>
        </div>
      </div>
    )
  }

  // Success
  if (step === 'confirm' && txHash) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card p-10 text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-green/10 border border-green/20 flex items-center justify-center mx-auto">
            <span className="text-green text-3xl">&#x2713;</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-tx">Deal Created</h2>
            <p className="text-tx3 text-sm mt-2">
              Your {assetType === 'erc20' ? 'tokens are' : 'NFT is'} now in escrow. The sequencer will pick up the listing shortly.
            </p>
          </div>
          <div className="bg-bg rounded-lg p-3">
            <div className="text-tx3 text-[10px] uppercase tracking-wider mb-1">Transaction Hash</div>
            <p className="text-tx text-xs font-mono break-all">{txHash}</p>
          </div>
          <div className="flex gap-3 justify-center pt-2">
            <button onClick={() => router.push('/')} className="btn btn-primary">
              View Marketplace
            </button>
            <button onClick={() => router.push('/portfolio')} className="btn btn-secondary">
              My Portfolio
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 fi">
      {/* Header */}
      <div className="fi1">
        <Link href="/" className="text-tx3 text-sm hover:text-tx transition-colors inline-flex items-center gap-1.5 mb-4">
          &larr; Back to Marketplace
        </Link>
        <h1 className="text-2xl font-bold text-tx">Create Deal</h1>
        <p className="text-tx3 text-sm mt-1">Sell tokens or NFTs cross-chain with ZK settlement</p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-3 fi2">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-3 flex-1">
            {i > 0 && <div className={`h-px flex-1 transition-colors ${step === 'price' ? 'bg-lav/30' : 'bg-brd'}`} />}
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step === s.key
                  ? 'bg-grad text-bg shadow-glow-lav'
                  : i === 0 && step === 'price'
                    ? 'bg-green/10 text-green border border-green/20'
                    : 'bg-bg3 text-tx3 border border-brd'
              }`}>
                {i === 0 && step === 'price' ? '\u2713' : s.num}
              </div>
              <span className={`text-sm font-medium ${step === s.key ? 'text-tx' : 'text-tx3'}`}>
                {s.label}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="card border-red/30 bg-red/5 p-4 flex items-start gap-3">
          <span className="text-red text-sm mt-px">!</span>
          <p className="text-red text-sm flex-1">{error}</p>
          <button onClick={() => setError('')} className="text-red/60 hover:text-red text-xs">&times;</button>
        </div>
      )}

      {/* Step 1: Select Asset */}
      {step === 'select' && (
        <div className="card p-6 space-y-5 fi3">
          {/* Asset type selector */}
          <div>
            <label className="text-tx2 text-xs font-medium uppercase tracking-wider block mb-2">Asset Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setAssetType('erc20'); setTokenContract(''); setTokenSymbol(''); setTokenAmount(''); setTokenId(''); setTokenDecimals(18); setError('') }}
                className={`py-3 rounded-xl text-sm font-medium transition-all border ${
                  assetType === 'erc20'
                    ? 'bg-green/8 text-green border-green/20'
                    : 'bg-bg text-tx3 border-brd hover:border-brd2'
                }`}
              >
                <div className="text-lg mb-0.5">$</div>
                Token
              </button>
              <button
                onClick={() => { setAssetType('erc721'); setTokenContract(''); setTokenSymbol(''); setTokenAmount(''); setTokenId(''); setTokenDecimals(18); setError('') }}
                className={`py-3 rounded-xl text-sm font-medium transition-all border ${
                  assetType === 'erc721'
                    ? 'bg-lav/8 text-lav border-lav/20'
                    : 'bg-bg text-tx3 border-brd hover:border-brd2'
                }`}
              >
                <div className="text-lg mb-0.5">N</div>
                NFT
              </button>
            </div>
          </div>

          {/* Contract address */}
          <div>
            <label className="text-tx2 text-xs font-medium uppercase tracking-wider block mb-2">Contract Address</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tokenContract}
                onChange={(e) => setTokenContract(e.target.value)}
                placeholder="0x..."
                className="form-input flex-1 font-mono text-xs"
              />
              <button onClick={lookupToken} className="btn btn-secondary whitespace-nowrap">
                Lookup
              </button>
            </div>
            {tokenSymbol && (
              <div className="flex items-center gap-1.5 mt-2 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-green" />
                <span className="text-green font-medium">Found: {tokenSymbol}</span>
              </div>
            )}
          </div>

          {/* Amount / Token ID */}
          {assetType === 'erc20' ? (
            <div>
              <label className="text-tx2 text-xs font-medium uppercase tracking-wider block mb-2">Amount</label>
              <input
                type="text"
                value={tokenAmount}
                onChange={(e) => setTokenAmount(e.target.value)}
                placeholder="1000"
                className="form-input"
              />
              {tokenSymbol && (
                <p className="text-tx3 text-xs mt-1.5">{tokenSymbol} tokens</p>
              )}
            </div>
          ) : (
            <div>
              <label className="text-tx2 text-xs font-medium uppercase tracking-wider block mb-2">Token ID</label>
              <input
                type="text"
                value={tokenId}
                onChange={(e) => setTokenId(e.target.value)}
                placeholder="0"
                className="form-input"
              />
            </div>
          )}

          <button
            onClick={() => setStep('price')}
            disabled={!tokenContract || (assetType === 'erc20' ? !tokenAmount : !tokenId)}
            className="btn btn-primary btn-lg w-full justify-center"
          >
            Continue
          </button>
        </div>
      )}

      {/* Step 2: Price & Chain */}
      {step === 'price' && (
        <div className="space-y-4 fi3">
          <div className="card p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-tx2 text-xs font-medium uppercase tracking-wider block mb-2">Asset Chain</label>
                <select
                  value={assetChainId}
                  onChange={(e) => setAssetChainId(Number(e.target.value))}
                  className="form-select"
                >
                  {SUPPORTED_CHAIN_IDS.map((id) => (
                    <option key={id} value={id}>{getContracts(id)?.name}</option>
                  ))}
                </select>
                <p className="text-tx3 text-[10px] mt-1">Where your asset is</p>
              </div>

              <div>
                <label className="text-tx2 text-xs font-medium uppercase tracking-wider block mb-2">Payment Chain</label>
                <select
                  value={paymentChainId}
                  onChange={(e) => setPaymentChainId(Number(e.target.value))}
                  className="form-select"
                >
                  {SUPPORTED_CHAIN_IDS.map((id) => (
                    <option key={id} value={id}>{getContracts(id)?.name}</option>
                  ))}
                </select>
                <p className="text-tx3 text-[10px] mt-1">Where buyer pays</p>
              </div>
            </div>

            <div>
              <label className="text-tx2 text-xs font-medium uppercase tracking-wider block mb-2">Price (ETH)</label>
              <input
                type="text"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.01"
                className="form-input text-lg font-semibold"
              />
            </div>
          </div>

          {/* Deal preview */}
          <div className="card-grad rounded-card p-5 space-y-3">
            <div className="text-tx2 text-[10px] uppercase tracking-wider font-semibold">Deal Preview</div>
            <div className="space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-tx3">Asset</span>
                <span className="text-tx font-medium">
                  {assetType === 'erc20' ? `${tokenAmount} ${tokenSymbol || 'tokens'}` : `NFT #${tokenId}`}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-tx3">Contract</span>
                <span className="text-tx font-mono text-xs">{tokenContract.slice(0, 10)}...{tokenContract.slice(-6)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-tx3">Route</span>
                <span className="text-tx font-medium">{getContracts(assetChainId)?.shortName} &rarr; {getContracts(paymentChainId)?.shortName}</span>
              </div>
              <div className="h-px bg-brd/50" />
              <div className="flex justify-between text-sm">
                <span className="text-tx3">Price</span>
                <span className="text-tx font-bold text-base">{price || '—'} ETH</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('select')} className="btn btn-secondary flex-1 justify-center">
              &larr; Back
            </button>
            <button
              onClick={handleList}
              disabled={!price || loading}
              className="btn btn-primary btn-lg flex-[2] justify-center"
            >
              {loading ? (
                <span className="flex items-center gap-2 justify-center">
                  <span className="w-4 h-4 border-2 border-bg border-t-transparent rounded-full animate-spin" />
                  Creating Deal...
                </span>
              ) : (
                'Create Deal'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
