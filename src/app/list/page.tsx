'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ethers } from 'ethers'
import { useWallet } from '@/hooks/useWallet'
import { ESCROW_ABI, ERC20_ABI, ERC721_ABI } from '@/config/abis'
import { SUPPORTED_CHAIN_IDS, getContracts } from '@/config/contracts'

type AssetType = 'erc20' | 'erc721'
type Step = 'select' | 'price' | 'confirm'

export default function ListPage() {
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
      setError('Could not read contract. Make sure you are on the right network.')
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
      setError(e.reason || e.message || 'Transaction failed')
    } finally {
      setLoading(false)
    }
  }

  if (!address) {
    return (
      <div className="card p-12 text-center">
        <p className="text-tx2 text-lg font-medium">Connect your wallet</p>
        <p className="text-tx3 text-sm mt-2">You need a wallet to list assets</p>
      </div>
    )
  }

  // Success
  if (step === 'confirm' && txHash) {
    return (
      <div className="card p-12 text-center space-y-4">
        <div className="text-4xl text-green">&#x2713;</div>
        <h2 className="text-xl font-bold text-tx">Listed Successfully</h2>
        <p className="text-tx3 text-sm">
          Your {assetType === 'erc20' ? 'tokens' : 'NFT'} are now in escrow. The sequencer will pick up the listing shortly.
        </p>
        <p className="text-tx3 text-xs font-mono">{txHash}</p>
        <div className="flex gap-3 justify-center mt-4">
          <button onClick={() => router.push('/')} className="btn btn-primary">
            View Marketplace
          </button>
          <button onClick={() => router.push('/portfolio')} className="btn btn-secondary">
            My Portfolio
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-tx">List Asset</h1>
        <p className="text-tx3 text-sm mt-1">List tokens or NFTs for cross-chain sale</p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2 text-sm">
        {(['select', 'price'] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <div className="w-8 h-px bg-brd" />}
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              step === s ? 'bg-lav text-bg' : 'bg-bg3 text-tx3'
            }`}>
              {i + 1}
            </div>
            <span className={step === s ? 'text-tx font-medium' : 'text-tx3'}>
              {s === 'select' ? 'Asset' : 'Price & Chain'}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div className="card border-red/30 bg-red/5 p-3 text-red text-sm">{error}</div>
      )}

      {/* Step 1: Select Asset */}
      {step === 'select' && (
        <div className="card p-6 space-y-5">
          <div className="flex gap-2">
            <button
              onClick={() => setAssetType('erc20')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                assetType === 'erc20' ? 'bg-lav/10 text-lav border border-lav/20' : 'bg-bg3 text-tx3 border border-transparent'
              }`}
            >
              Token
            </button>
            <button
              onClick={() => setAssetType('erc721')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                assetType === 'erc721' ? 'bg-lav/10 text-lav border border-lav/20' : 'bg-bg3 text-tx3 border border-transparent'
              }`}
            >
              NFT
            </button>
          </div>

          <div>
            <label className="text-tx2 text-sm font-medium block mb-1.5">Contract Address</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tokenContract}
                onChange={(e) => setTokenContract(e.target.value)}
                placeholder="0x..."
                className="form-input flex-1"
              />
              <button onClick={lookupToken} className="btn btn-secondary text-sm">
                Lookup
              </button>
            </div>
            {tokenSymbol && (
              <p className="text-green text-xs mt-1">Found: {tokenSymbol}</p>
            )}
          </div>

          {assetType === 'erc20' ? (
            <div>
              <label className="text-tx2 text-sm font-medium block mb-1.5">Amount</label>
              <input
                type="text"
                value={tokenAmount}
                onChange={(e) => setTokenAmount(e.target.value)}
                placeholder="1000"
                className="form-input"
              />
              {tokenSymbol && (
                <p className="text-tx3 text-xs mt-1">{tokenSymbol} tokens</p>
              )}
            </div>
          ) : (
            <div>
              <label className="text-tx2 text-sm font-medium block mb-1.5">Token ID</label>
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
            className="btn btn-primary w-full"
          >
            Continue
          </button>
        </div>
      )}

      {/* Step 2: Price & Chain */}
      {step === 'price' && (
        <div className="card p-6 space-y-5">
          <div>
            <label className="text-tx2 text-sm font-medium block mb-1.5">Asset Chain</label>
            <select
              value={assetChainId}
              onChange={(e) => setAssetChainId(Number(e.target.value))}
              className="form-input"
            >
              {SUPPORTED_CHAIN_IDS.map((id) => (
                <option key={id} value={id}>{getContracts(id)?.name}</option>
              ))}
            </select>
            <p className="text-tx3 text-xs mt-1">Chain where your asset is</p>
          </div>

          <div>
            <label className="text-tx2 text-sm font-medium block mb-1.5">Payment Chain</label>
            <select
              value={paymentChainId}
              onChange={(e) => setPaymentChainId(Number(e.target.value))}
              className="form-input"
            >
              {SUPPORTED_CHAIN_IDS.map((id) => (
                <option key={id} value={id}>{getContracts(id)?.name}</option>
              ))}
            </select>
            <p className="text-tx3 text-xs mt-1">Chain where buyer will pay</p>
          </div>

          <div>
            <label className="text-tx2 text-sm font-medium block mb-1.5">Price (ETH)</label>
            <input
              type="text"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.01"
              className="form-input"
            />
          </div>

          <div className="bg-bg2 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between text-tx3">
              <span>Asset</span>
              <span className="text-tx font-medium">
                {assetType === 'erc20' ? `${tokenAmount} ${tokenSymbol || 'tokens'}` : `NFT #${tokenId}`}
              </span>
            </div>
            <div className="flex justify-between text-tx3">
              <span>Contract</span>
              <span className="text-tx font-mono text-xs">{tokenContract.slice(0, 10)}...{tokenContract.slice(-6)}</span>
            </div>
            <div className="flex justify-between text-tx3">
              <span>Route</span>
              <span className="text-tx">{getContracts(assetChainId)?.shortName} &rarr; {getContracts(paymentChainId)?.shortName}</span>
            </div>
            <div className="flex justify-between text-tx3">
              <span>Price</span>
              <span className="text-tx font-semibold">{price || '—'} ETH</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('select')} className="btn btn-secondary flex-1">
              Back
            </button>
            <button
              onClick={handleList}
              disabled={!price || loading}
              className="btn btn-primary flex-1"
            >
              {loading ? (
                <span className="flex items-center gap-2 justify-center">
                  <span className="w-4 h-4 border-2 border-bg border-t-transparent rounded-full animate-spin" />
                  Listing...
                </span>
              ) : (
                'List Asset'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
