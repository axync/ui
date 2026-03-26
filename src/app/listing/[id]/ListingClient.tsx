'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ethers } from 'ethers'
import { useWallet } from '@/hooks/useWallet'
import { api, NftListing, ReleaseProof } from '@/services/api'
import { getContracts, EIP712_DOMAIN, BUYNFT_TYPES } from '@/config/contracts'
import { VAULT_ABI, ESCROW_ABI } from '@/config/abis'

type BuyStep = 'details' | 'deposit' | 'buy' | 'waiting' | 'claim' | 'done'

const BUY_STEPS = [
  { key: 'deposit', label: 'Deposit', icon: '1' },
  { key: 'buy', label: 'Sign', icon: '2' },
  { key: 'waiting', label: 'Process', icon: '3' },
  { key: 'claim', label: 'Claim', icon: '4' },
] as const

export default function ListingClient() {
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

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card p-12 text-center">
          <div className="w-8 h-8 border-2 border-lav/30 border-t-lav rounded-full animate-spin mx-auto" />
          <p className="text-tx3 text-sm mt-4">Loading deal...</p>
        </div>
      </div>
    )
  }

  if (!listing) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card p-12 text-center">
          <p className="text-red font-medium">{error || 'Deal not found'}</p>
          <Link href="/" className="btn btn-secondary mt-4 inline-flex">
            Back to Marketplace
          </Link>
        </div>
      </div>
    )
  }

  const assetChain = getContracts(listing.nft_chain_id)
  const paymentChain = getContracts(listing.payment_chain_id)
  const priceEth = ethers.formatEther(listing.price)
  const isSeller = address?.toLowerCase() === listing.seller?.toLowerCase()
  const isToken = listing.asset_type === 'ERC20'

  const assetLabel = isToken
    ? `${ethers.formatEther(listing.amount?.toString() || '0')} tokens`
    : `NFT #${listing.token_id}`

  // Step 1: Deposit ETH on payment chain
  async function handleDeposit() {
    if (!address || !window.ethereum || !paymentChain) return
    setTxLoading(true)
    setError('')

    try {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x' + listing!.payment_chain_id.toString(16) }],
        })
      } catch (switchErr: any) {
        if (switchErr.code === 4001) {
          setError('Please switch to the payment chain to continue')
          setTxLoading(false)
          return
        }
        throw switchErr
      }

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const vault = new ethers.Contract(paymentChain.vault, VAULT_ABI, signer)

      const tx = await vault.depositNative(0, { value: listing!.price })
      await tx.wait()

      setBuyStep('buy')
    } catch (e: any) {
      if (e.code === 4001 || e.code === 'ACTION_REJECTED') {
        setError('Transaction rejected')
      } else {
        setError(e.reason || e.shortMessage || 'Deposit failed')
      }
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
      const account = await api.getAccountState(address)
      const nonce = account.nonce || 0

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()

      const signature = await signer.signTypedData(EIP712_DOMAIN, BUYNFT_TYPES, {
        from: address,
        nonce: nonce,
        listingId: listing!.id,
      })

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
            const proofData = await api.getReleaseProof(listingId)
            setProof(proofData)
            setBuyStep('claim')
            return
          }
        } catch {}
      }

      setError('Timeout waiting for block execution. Try claiming later from Portfolio.')
      setBuyStep('claim')
      try {
        const proofData = await api.getReleaseProof(listingId)
        setProof(proofData)
      } catch {}
    } catch (e: any) {
      if (e.code === 4001 || e.code === 'ACTION_REJECTED') {
        setError('Transaction rejected')
      } else {
        setError(e.reason || e.shortMessage || 'Purchase failed')
      }
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
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x' + listing!.nft_chain_id.toString(16) }],
        })
      } catch (switchErr: any) {
        if (switchErr.code === 4001) {
          setError('Please switch to the asset chain to claim')
          setTxLoading(false)
          return
        }
        throw switchErr
      }

      const provider = new ethers.BrowserProvider(window.ethereum)
      const escrow = new ethers.Contract(assetChain.escrow, ESCROW_ABI, provider)

      // Poll for withdrawalsRoot
      setError('Waiting for relayer to submit proof on-chain...')
      for (let i = 0; i < 60; i++) {
        const root = await escrow.withdrawalsRoot()
        if (root === proof.leaf || i > 50) break
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
      if (e.code === 4001 || e.code === 'ACTION_REJECTED') {
        setError('Transaction rejected')
      } else {
        setError(e.reason || e.shortMessage || 'Claim failed')
      }
    } finally {
      setTxLoading(false)
    }
  }

  function getStepState(stepKey: string) {
    const stepOrder = ['deposit', 'buy', 'waiting', 'claim']
    const currentIdx = stepOrder.indexOf(buyStep)
    const stepIdx = stepOrder.indexOf(stepKey)
    if (buyStep === 'done') return 'done'
    if (buyStep === 'details') return 'pending'
    if (stepIdx < currentIdx) return 'done'
    if (stepIdx === currentIdx) return 'active'
    return 'pending'
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 fi">
      {/* Back nav */}
      <Link href="/" className="text-tx3 text-sm hover:text-tx transition-colors inline-flex items-center gap-1.5 fi1">
        &larr; Back to Marketplace
      </Link>

      {/* Deal info card */}
      <div className="card overflow-hidden fi2">
        {/* Header with gradient */}
        <div className={`px-6 py-5 border-b border-brd ${isToken ? 'bg-green/[0.03]' : 'bg-lav/[0.03]'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold ${
                isToken ? 'bg-green/10 text-green border border-green/10' : 'bg-lav/10 text-lav border border-lav/10'
              }`}>
                {isToken ? '$' : 'N'}
              </div>
              <div>
                <h1 className="text-xl font-bold text-tx">{assetLabel}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className={isToken ? 'badge-green' : 'badge-lav'}>
                    {isToken ? 'Token' : 'NFT'}
                  </span>
                  <span className="text-tx3 text-xs font-mono">
                    {listing.nft_contract.slice(0, 10)}...{listing.nft_contract.slice(-4)}
                  </span>
                </div>
              </div>
            </div>
            <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
              listing.status === 'Active' ? 'bg-green/10 text-green border border-green/20' :
              listing.status === 'Sold' ? 'bg-lav/10 text-lav border border-lav/20' : 'bg-red/10 text-red border border-red/20'
            }`}>
              {listing.status}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="bg-bg rounded-xl p-4 border border-brd/50">
              <div className="text-tx3 text-[10px] uppercase tracking-wider font-medium">Price</div>
              <div className="text-tx font-bold text-2xl mt-1">{priceEth} ETH</div>
            </div>
            <div className="bg-bg rounded-xl p-4 border border-brd/50">
              <div className="text-tx3 text-[10px] uppercase tracking-wider font-medium">Route</div>
              <div className="text-tx font-semibold text-lg mt-1">
                {assetChain?.shortName} &rarr; {paymentChain?.shortName}
              </div>
            </div>
          </div>

          <div className="space-y-0">
            <div className="flex justify-between py-3 border-b border-brd/40 text-sm">
              <span className="text-tx3">Seller</span>
              <span className="text-tx font-mono text-xs">{listing.seller.slice(0, 8)}...{listing.seller.slice(-6)}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-brd/40 text-sm">
              <span className="text-tx3">On-chain ID</span>
              <span className="text-tx font-mono">#{listing.on_chain_listing_id}</span>
            </div>
            <div className="flex justify-between py-3 text-sm">
              <span className="text-tx3">Sequencer ID</span>
              <span className="text-tx font-mono">#{listing.id}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="card border-red/30 bg-red/5 p-4 flex items-start gap-3">
          <span className="text-red text-sm mt-px">!</span>
          <p className="text-red text-sm flex-1">{error}</p>
          <button onClick={() => setError('')} className="text-red/60 hover:text-red text-xs">&times;</button>
        </div>
      )}

      {/* Buy flow */}
      {listing.status === 'Active' && !isSeller && address && (
        <div className="card p-6 space-y-5 fi3">
          <h2 className="text-lg font-bold text-tx">Buy This Deal</h2>

          {/* Step progress */}
          <div className="flex items-center gap-0">
            {BUY_STEPS.map((s, i) => {
              const state = getStepState(s.key)
              return (
                <div key={s.key} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      state === 'done' ? 'bg-green/10 text-green border border-green/20' :
                      state === 'active' ? 'bg-grad text-bg shadow-glow-lav' :
                      'bg-bg3 text-tx3 border border-brd'
                    }`}>
                      {state === 'done' ? '\u2713' : s.icon}
                    </div>
                    <span className={`text-[10px] font-medium ${
                      state === 'active' ? 'text-tx' : state === 'done' ? 'text-green' : 'text-tx3'
                    }`}>
                      {s.label}
                    </span>
                  </div>
                  {i < BUY_STEPS.length - 1 && (
                    <div className={`flex-1 h-px mx-2 mt-[-18px] transition-colors ${
                      state === 'done' ? 'bg-green/30' : 'bg-brd'
                    }`} />
                  )}
                </div>
              )
            })}
          </div>

          {/* Step content */}
          <div className="bg-bg rounded-xl p-5 border border-brd/50">
            {buyStep === 'details' && (
              <div className="space-y-3">
                <p className="text-tx2 text-sm">
                  Deposit <strong className="text-tx">{priceEth} ETH</strong> on{' '}
                  <strong className="text-tx">{paymentChain?.shortName}</strong>, sign a purchase transaction, and claim your asset.
                </p>
                <button onClick={() => setBuyStep('deposit')} className="btn btn-primary btn-lg w-full justify-center">
                  Start Purchase
                </button>
              </div>
            )}

            {buyStep === 'deposit' && (
              <div className="space-y-3">
                <div className="text-tx2 text-xs uppercase tracking-wider font-medium">Step 1 — Deposit</div>
                <p className="text-tx3 text-sm">
                  Deposit {priceEth} ETH to AxyncVault on {paymentChain?.shortName}. Your wallet will prompt for a transaction.
                </p>
                <button onClick={handleDeposit} disabled={txLoading} className="btn btn-primary btn-lg w-full justify-center">
                  {txLoading ? (
                    <span className="flex items-center gap-2">
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
                <div className="text-tx2 text-xs uppercase tracking-wider font-medium">Step 2 — Sign Transaction</div>
                <p className="text-tx3 text-sm">
                  Sign an EIP-712 message to authorize the purchase through the sequencer.
                </p>
                <button onClick={handleBuyNft} disabled={txLoading} className="btn btn-primary btn-lg w-full justify-center">
                  {txLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-bg border-t-transparent rounded-full animate-spin" />
                      Signing...
                    </span>
                  ) : (
                    'Sign & Submit'
                  )}
                </button>
              </div>
            )}

            {buyStep === 'waiting' && (
              <div className="text-center py-4 space-y-4">
                <div className="w-10 h-10 border-2 border-lav/30 border-t-lav rounded-full animate-spin mx-auto" />
                <div>
                  <p className="text-tx2 font-medium">Processing your trade...</p>
                  <p className="text-tx3 text-xs mt-1">The sequencer is executing your purchase. This usually takes 5-15 seconds.</p>
                </div>
              </div>
            )}

            {buyStep === 'claim' && proof && (
              <div className="space-y-3">
                <div className="text-tx2 text-xs uppercase tracking-wider font-medium">Step 3 — Claim Asset</div>
                <p className="text-tx3 text-sm">
                  Claim your {isToken ? 'tokens' : 'NFT'} on {assetChain?.shortName} using the ZK merkle proof.
                </p>
                <button onClick={handleClaim} disabled={txLoading} className="btn btn-primary btn-lg w-full justify-center">
                  {txLoading ? (
                    <span className="flex items-center gap-2">
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
              <div className="text-center py-4 space-y-4">
                <div className="w-14 h-14 rounded-full bg-green/10 border border-green/20 flex items-center justify-center mx-auto">
                  <span className="text-green text-2xl">&#x2713;</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-tx">Purchase Complete!</h3>
                  <p className="text-tx3 text-sm mt-1">
                    Asset claimed on {assetChain?.shortName}
                  </p>
                </div>
                {claimTxHash && (
                  <div className="bg-bg2 rounded-lg p-3 mx-auto max-w-sm">
                    <div className="text-tx3 text-[10px] uppercase tracking-wider mb-1">Claim TX</div>
                    <p className="text-tx text-xs font-mono break-all">{claimTxHash}</p>
                  </div>
                )}
                <button onClick={() => router.push('/portfolio')} className="btn btn-primary">
                  View Portfolio
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sold state */}
      {listing.status === 'Sold' && listing.buyer && (
        <div className="card p-6 text-center space-y-2">
          <div className="badge-lav mx-auto inline-flex">Sold</div>
          <p className="text-tx2 font-medium">This deal has been completed</p>
          <p className="text-tx3 text-xs font-mono">
            Buyer: {listing.buyer.slice(0, 8)}...{listing.buyer.slice(-6)}
          </p>
        </div>
      )}

      {/* Not connected */}
      {!address && listing.status === 'Active' && (
        <div className="card p-8 text-center space-y-2">
          <p className="text-tx font-medium">Connect your wallet to buy</p>
          <p className="text-tx3 text-sm">Use the Connect Wallet button in the navbar</p>
        </div>
      )}
    </div>
  )
}
