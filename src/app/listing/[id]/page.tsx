'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ethers } from 'ethers'
import { useWallet } from '@/hooks/useWallet'
import { api, NftListing, ReleaseProof } from '@/services/api'
import { getContracts, EIP712_DOMAIN, BUYNFT_TYPES } from '@/config/contracts'
import { VAULT_ABI, ESCROW_ABI } from '@/config/abis'

type BuyStep = 'details' | 'deposit' | 'buy' | 'waiting' | 'claim' | 'done'

export default function ListingPage() {
  const params = useParams()
  const router = useRouter()
  const { address } = useWallet()
  const listingId = Number(params.id)

  const [listing, setListing] = useState<NftListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Buy flow state
  const [buyStep, setBuyStep] = useState<BuyStep>('details')
  const [txLoading, setTxLoading] = useState(false)
  const [proof, setProof] = useState<ReleaseProof | null>(null)
  const [claimTxHash, setClaimTxHash] = useState('')

  const loadListing = useCallback(async () => {
    try {
      const data = await api.getNftListing(listingId)
      setListing(data)
    } catch (err) {
      setError('Listing not found')
    } finally {
      setLoading(false)
    }
  }, [listingId])

  useEffect(() => {
    loadListing()
  }, [loadListing])

  if (loading) return <div className="card p-12 text-center text-tx3">Loading...</div>
  if (!listing) return <div className="card p-12 text-center text-red">{error || 'Not found'}</div>

  const assetChain = getContracts(listing.nft_chain_id)
  const paymentChain = getContracts(listing.payment_chain_id)
  const priceEth = ethers.formatEther(listing.price)
  const isSeller = address?.toLowerCase() === listing.seller?.toLowerCase()

  // Step 1: Deposit ETH on payment chain
  async function handleDeposit() {
    if (!address || !window.ethereum || !paymentChain) return
    setTxLoading(true)
    setError('')

    try {
      // Switch to payment chain
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x' + listing!.payment_chain_id.toString(16) }],
      })

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const vault = new ethers.Contract(paymentChain.vault, VAULT_ABI, signer)

      const tx = await vault.depositNative(0, { value: listing!.price })
      await tx.wait()

      setBuyStep('buy')
    } catch (e: any) {
      setError(e.reason || e.message || 'Deposit failed')
    } finally {
      setTxLoading(false)
    }
  }

  // Step 2: Submit BuyNft TX to sequencer
  async function handleBuyNft() {
    if (!address || !window.ethereum) return
    setTxLoading(true)
    setError('')

    try {
      // Get nonce from sequencer
      const account = await api.getAccountState(address)
      const nonce = account.nonce || 0

      // Sign EIP-712
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()

      const signature = await signer.signTypedData(EIP712_DOMAIN, BUYNFT_TYPES, {
        from: address,
        nonce: nonce,
        listingId: listing!.id,
      })

      // Submit to API
      await api.submitTransaction({
        kind: 'BuyNft',
        from: address,
        listing_id: listing!.id,
        nonce: nonce,
        signature: signature,
      })

      setBuyStep('waiting')

      // Poll for listing to become Sold
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000))
        try {
          const updated = await api.getNftListing(listingId)
          if (updated.status === 'Sold') {
            setListing(updated)
            // Get proof
            const proofData = await api.getReleaseProof(listingId)
            setProof(proofData)
            setBuyStep('claim')
            return
          }
        } catch {}
      }

      setError('Timeout waiting for block execution. Try claiming later from Portfolio.')
      setBuyStep('claim')
      // Still try to get proof
      try {
        const proofData = await api.getReleaseProof(listingId)
        setProof(proofData)
      } catch {}
    } catch (e: any) {
      setError(e.reason || e.message || 'BuyNft failed')
    } finally {
      setTxLoading(false)
    }
  }

  // Step 3: Claim on asset chain
  async function handleClaim() {
    if (!address || !window.ethereum || !proof || !assetChain) return
    setTxLoading(true)
    setError('')

    try {
      // Switch to asset chain
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x' + listing!.nft_chain_id.toString(16) }],
      })

      // Wait for relayer to submit withdrawalsRoot
      const provider = new ethers.BrowserProvider(window.ethereum)
      const escrow = new ethers.Contract(assetChain.escrow, ESCROW_ABI, provider)

      // Poll for withdrawalsRoot to match
      for (let i = 0; i < 60; i++) {
        const root = await escrow.withdrawalsRoot()
        if (root === proof.leaf || i > 50) break
        if (i % 10 === 0 && i > 0) {
          setError(`Waiting for relayer to submit proof on-chain... (${i}s)`)
        }
        await new Promise(r => setTimeout(r, 3000))
      }
      setError('')

      const signer = await provider.getSigner()
      const escrowSigner = new ethers.Contract(assetChain.escrow, ESCROW_ABI, signer)

      const tx = await escrowSigner.claim(
        proof.on_chain_listing_id,
        proof.buyer,
        proof.merkle_proof,
        proof.nullifier
      )
      const receipt = await tx.wait()
      setClaimTxHash(receipt.hash)
      setBuyStep('done')
    } catch (e: any) {
      setError(e.reason || e.message || 'Claim failed')
    } finally {
      setTxLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => router.push('/')} className="text-tx3 text-sm hover:text-tx transition-colors">
        &larr; Back to Marketplace
      </button>

      {/* Listing info card */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${
              listing.asset_type === 'ERC20' ? 'bg-green/10 text-green' : 'bg-lav/10 text-lav'
            }`}>
              {listing.asset_type === 'ERC20' ? '$' : 'N'}
            </div>
            <div>
              <h1 className="text-xl font-bold text-tx">
                {listing.asset_type === 'ERC20'
                  ? `${ethers.formatEther(listing.amount?.toString() || '0')} tokens`
                  : `NFT #${listing.token_id}`
                }
              </h1>
              <span className={listing.asset_type === 'ERC20' ? 'badge-green' : 'badge-lav'}>
                {listing.asset_type === 'ERC20' ? 'Token' : 'NFT'}
              </span>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
            listing.status === 'Active' ? 'bg-green/10 text-green' :
            listing.status === 'Sold' ? 'bg-lav/10 text-lav' : 'bg-red/10 text-red'
          }`}>
            {listing.status}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-bg2 rounded-xl p-3">
            <div className="text-tx3 text-xs">Price</div>
            <div className="text-tx font-semibold text-lg mt-0.5">{priceEth} ETH</div>
          </div>
          <div className="bg-bg2 rounded-xl p-3">
            <div className="text-tx3 text-xs">Route</div>
            <div className="text-tx font-medium mt-0.5">
              {assetChain?.shortName} &rarr; {paymentChain?.shortName}
            </div>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-1.5 border-b border-brd">
            <span className="text-tx3">Contract</span>
            <span className="text-tx font-mono text-xs">{listing.nft_contract}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-brd">
            <span className="text-tx3">Seller</span>
            <span className="text-tx font-mono text-xs">{listing.seller}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-brd">
            <span className="text-tx3">On-chain Listing ID</span>
            <span className="text-tx">#{listing.on_chain_listing_id}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-tx3">Sequencer ID</span>
            <span className="text-tx">#{listing.id}</span>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="card border-red/30 bg-red/5 p-3 text-red text-sm">{error}</div>
      )}

      {/* Buy flow */}
      {listing.status === 'Active' && !isSeller && address && (
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-bold text-tx">Buy This Asset</h2>

          {/* Progress */}
          <div className="flex items-center gap-1 text-xs">
            {['Deposit', 'Sign TX', 'Wait', 'Claim'].map((label, i) => {
              const stepIndex = ['deposit', 'buy', 'waiting', 'claim'].indexOf(buyStep)
              const isActive = i === stepIndex
              const isDone = i < stepIndex || buyStep === 'done'
              return (
                <div key={label} className="flex items-center gap-1 flex-1">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isDone ? 'bg-green text-bg' : isActive ? 'bg-lav text-bg' : 'bg-bg3 text-tx3'
                  }`}>
                    {isDone ? '\u2713' : i + 1}
                  </div>
                  <span className={isActive ? 'text-tx' : 'text-tx3'}>{label}</span>
                  {i < 3 && <div className="flex-1 h-px bg-brd mx-1" />}
                </div>
              )
            })}
          </div>

          {buyStep === 'details' && (
            <div className="space-y-3">
              <p className="text-tx3 text-sm">
                To buy this asset, you need to deposit <strong className="text-tx">{priceEth} ETH</strong> on{' '}
                <strong className="text-tx">{paymentChain?.shortName}</strong>, then sign a purchase transaction.
              </p>
              <button onClick={() => setBuyStep('deposit')} className="btn btn-primary w-full">
                Start Purchase
              </button>
            </div>
          )}

          {buyStep === 'deposit' && (
            <div className="space-y-3">
              <p className="text-tx3 text-sm">
                Step 1: Deposit {priceEth} ETH to AxyncVault on {paymentChain?.shortName}
              </p>
              <button onClick={handleDeposit} disabled={txLoading} className="btn btn-primary w-full">
                {txLoading ? (
                  <span className="flex items-center gap-2 justify-center">
                    <span className="w-4 h-4 border-2 border-bg border-t-transparent rounded-full animate-spin" />
                    Depositing...
                  </span>
                ) : (
                  `Deposit ${priceEth} ETH`
                )}
              </button>
            </div>
          )}

          {buyStep === 'buy' && (
            <div className="space-y-3">
              <p className="text-tx3 text-sm">
                Step 2: Sign EIP-712 purchase transaction for the sequencer
              </p>
              <button onClick={handleBuyNft} disabled={txLoading} className="btn btn-primary w-full">
                {txLoading ? (
                  <span className="flex items-center gap-2 justify-center">
                    <span className="w-4 h-4 border-2 border-bg border-t-transparent rounded-full animate-spin" />
                    Signing...
                  </span>
                ) : (
                  'Sign & Submit BuyNft'
                )}
              </button>
            </div>
          )}

          {buyStep === 'waiting' && (
            <div className="text-center space-y-3">
              <div className="w-8 h-8 border-2 border-lav border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-tx3 text-sm">Waiting for sequencer to process your trade...</p>
              <p className="text-tx3 text-xs">This usually takes 5-15 seconds</p>
            </div>
          )}

          {buyStep === 'claim' && proof && (
            <div className="space-y-3">
              <p className="text-tx3 text-sm">
                Step 3: Claim your asset on {assetChain?.shortName} using the merkle proof
              </p>
              <button onClick={handleClaim} disabled={txLoading} className="btn btn-primary w-full">
                {txLoading ? (
                  <span className="flex items-center gap-2 justify-center">
                    <span className="w-4 h-4 border-2 border-bg border-t-transparent rounded-full animate-spin" />
                    Claiming...
                  </span>
                ) : (
                  'Claim Asset'
                )}
              </button>
            </div>
          )}

          {buyStep === 'done' && (
            <div className="text-center space-y-3">
              <div className="text-4xl text-green">&#x2713;</div>
              <h3 className="text-lg font-bold text-tx">Purchase Complete!</h3>
              <p className="text-tx3 text-sm">
                Asset successfully claimed on {assetChain?.shortName}
              </p>
              {claimTxHash && (
                <p className="text-tx3 text-xs font-mono">{claimTxHash}</p>
              )}
              <button onClick={() => router.push('/portfolio')} className="btn btn-primary">
                View Portfolio
              </button>
            </div>
          )}
        </div>
      )}

      {/* Sold state */}
      {listing.status === 'Sold' && listing.buyer && (
        <div className="card p-6 text-center space-y-2">
          <p className="text-tx2 font-medium">This listing has been sold</p>
          <p className="text-tx3 text-sm">
            Buyer: {listing.buyer.slice(0, 8)}...{listing.buyer.slice(-6)}
          </p>
        </div>
      )}

      {/* Not connected */}
      {!address && listing.status === 'Active' && (
        <div className="card p-6 text-center">
          <p className="text-tx2">Connect your wallet to buy this asset</p>
        </div>
      )}
    </div>
  )
}
