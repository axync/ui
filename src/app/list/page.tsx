'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ethers } from 'ethers'
import { useWallet } from '@/hooks/useWallet'
import { api, VestingPosition, NftPosition } from '@/services/api'
import { formatAmount, formatAddress } from '@/utils/transactions'

const ERC721_ABI = [
  'function approve(address to, uint256 tokenId) external',
  'function getApproved(uint256 tokenId) view returns (address)',
  'function ownerOf(uint256 tokenId) view returns (address)',
]

type ListableItem = {
  type: 'vesting'
  data: VestingPosition
} | {
  type: 'nft'
  data: NftPosition
}

export default function ListPosition() {
  const { address } = useWallet()
  const router = useRouter()
  const [positions, setPositions] = useState<VestingPosition[]>([])
  const [genericNfts, setGenericNfts] = useState<NftPosition[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<ListableItem | null>(null)
  const [price, setPrice] = useState('')
  const [paymentToken, setPaymentToken] = useState<'ETH' | 'USDC'>('ETH')
  const [step, setStep] = useState<'select' | 'price' | 'approve' | 'list' | 'done'>('select')
  const [txStatus, setTxStatus] = useState('')
  const [manualContract, setManualContract] = useState('')
  const [manualTokenId, setManualTokenId] = useState('')
  const [manualError, setManualError] = useState('')
  const [tab, setTab] = useState<'vesting' | 'nft' | 'manual'>('vesting')

  const escrowContract = process.env.NEXT_PUBLIC_ESCROW_CONTRACT || ''

  const loadPositions = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getVestingPositions(address!)
      setPositions(data.positions.filter((p) => p.is_transferable))
    } catch (err) {
      console.error('Failed to load positions:', err)
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => {
    if (address) loadPositions()
  }, [address, loadPositions])

  async function scanNfts(contracts: string[]) {
    if (!address || contracts.length === 0) return
    setLoading(true)
    try {
      const data = await api.getNfts(address, contracts)
      setGenericNfts(data.nfts)
    } catch (err) {
      console.error('Failed to scan NFTs:', err)
    } finally {
      setLoading(false)
    }
  }

  function selectVesting(pos: VestingPosition) {
    setSelected({ type: 'vesting', data: pos })
    setStep('price')
  }

  function selectNft(nft: NftPosition) {
    setSelected({ type: 'nft', data: nft })
    setStep('price')
  }

  async function handleManualAdd() {
    setManualError('')
    if (!manualContract || !manualTokenId) {
      setManualError('Enter contract address and token ID')
      return
    }
    if (!ethers.isAddress(manualContract)) {
      setManualError('Invalid contract address')
      return
    }

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum)
      const nftContract = new ethers.Contract(manualContract, ['function ownerOf(uint256) view returns (address)'], provider)
      const owner = await nftContract.ownerOf(BigInt(manualTokenId))

      if (owner.toLowerCase() !== address!.toLowerCase()) {
        setManualError('You do not own this token')
        return
      }

      setSelected({
        type: 'nft',
        data: {
          contract: manualContract,
          token_id: Number(manualTokenId),
          name: '',
          symbol: '',
          token_uri: '',
        }
      })
      setStep('price')
    } catch (err: any) {
      setManualError(err.reason || err.message || 'Failed to verify ownership')
    }
  }

  function getSelectedContract(): string {
    if (!selected) return ''
    return selected.type === 'vesting' ? selected.data.contract : selected.data.contract
  }

  function getSelectedTokenId(): number {
    if (!selected) return 0
    return selected.type === 'vesting' ? selected.data.token_id : selected.data.token_id
  }

  function getSelectedLabel(): string {
    if (!selected) return ''
    if (selected.type === 'vesting') {
      const p = selected.data
      return `${p.platform.charAt(0).toUpperCase() + p.platform.slice(1)} #${p.token_id}`
    }
    const n = selected.data
    return n.name ? `${n.name} #${n.token_id}` : `NFT #${n.token_id}`
  }

  async function handleApproveAndList() {
    if (!selected || !price || !escrowContract) return

    const provider = new ethers.BrowserProvider((window as any).ethereum)
    const signer = await provider.getSigner()
    const contract = getSelectedContract()
    const tokenId = getSelectedTokenId()

    try {
      // Step 1: Approve NFT
      setStep('approve')
      setTxStatus('Approving NFT transfer...')
      const nftContract = new ethers.Contract(contract, ERC721_ABI, signer)
      const approved = await nftContract.getApproved(tokenId)

      if (approved.toLowerCase() !== escrowContract.toLowerCase()) {
        const approveTx = await nftContract.approve(escrowContract, tokenId)
        setTxStatus('Waiting for approval confirmation...')
        await approveTx.wait()
      }

      // Step 2: List on EscrowSwap
      setStep('list')
      setTxStatus('Listing on marketplace...')

      const escrowABI = [
        'function list(address nftContract, uint256 tokenId, address paymentToken, uint256 price) external returns (uint256)',
      ]
      const escrow = new ethers.Contract(escrowContract, escrowABI, signer)

      const paymentAddr = paymentToken === 'ETH'
        ? ethers.ZeroAddress
        : process.env.NEXT_PUBLIC_USDC_ADDRESS || ethers.ZeroAddress

      const priceWei = ethers.parseEther(price)
      const listTx = await escrow.list(contract, tokenId, paymentAddr, priceWei)
      setTxStatus('Waiting for listing confirmation...')
      await listTx.wait()

      setStep('done')
      setTxStatus('')
    } catch (err: any) {
      console.error('Listing failed:', err)
      setTxStatus(`Error: ${err.reason || err.message || 'Transaction failed'}`)
      setStep('price')
    }
  }

  function formatTime(ts: number): string {
    if (!ts) return '—'
    return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (!address) {
    return (
      <div className="card p-12 text-center fi">
        <p className="text-tx2 text-lg font-medium">Connect your wallet</p>
        <p className="text-tx3 text-sm mt-2">Connect your wallet to list NFTs on the marketplace</p>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="card p-12 text-center fi">
        <div className="w-16 h-16 rounded-2xl bg-green/10 flex items-center justify-center mx-auto mb-4">
          <span className="text-green text-2xl">&#10003;</span>
        </div>
        <p className="text-tx text-lg font-medium">Listed!</p>
        <p className="text-tx3 text-sm mt-2">Your NFT is now available on the marketplace</p>
        <div className="flex gap-3 justify-center mt-6">
          <button onClick={() => router.push('/')} className="btn btn-primary">View Marketplace</button>
          <button onClick={() => router.push('/portfolio')} className="btn btn-secondary">My Portfolio</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 fi">
      <div className="fi1">
        <h1 className="text-2xl font-bold text-tx">Sell NFT</h1>
        <p className="text-tx3 text-sm mt-1">List any ERC-721 NFT on the marketplace</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3 fi2">
        {['Select NFT', 'Set Price', 'Confirm'].map((label, i) => {
          const isCurrentOrPast =
            step === 'select' ? i === 0 :
            step === 'price' ? i <= 1 :
            true
          return (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                isCurrentOrPast ? 'bg-lav/20 text-lav' : 'bg-bg3 text-tx3'
              }`}>
                {i + 1}
              </div>
              <span className={`text-sm ${isCurrentOrPast ? 'text-tx' : 'text-tx3'}`}>{label}</span>
              {i < 2 && <span className="text-tx3 mx-1">&rarr;</span>}
            </div>
          )
        })}
      </div>

      {/* Step 1: Select NFT */}
      {step === 'select' && (
        <div className="space-y-4 fi3">
          {/* Source tabs */}
          <div className="flex items-center gap-2">
            {([
              { key: 'vesting' as const, label: 'Vesting NFTs' },
              { key: 'manual' as const, label: 'Any ERC-721' },
            ]).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  tab === t.key
                    ? 'bg-lav/10 text-lav border border-lav/20'
                    : 'text-tx3 hover:text-tx hover:bg-bg3 border border-transparent'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'vesting' && (
            <div className="space-y-3">
              {loading ? (
                <div className="card p-8 text-center text-tx3">Scanning wallet for vesting NFTs...</div>
              ) : positions.length === 0 ? (
                <div className="card p-8 text-center">
                  <p className="text-tx2 font-medium">No transferable vesting positions found</p>
                  <p className="text-tx3 text-sm mt-1">
                    We scan for Sablier and Hedgey vesting NFTs in your wallet
                  </p>
                </div>
              ) : (
                positions.map((pos) => (
                  <button
                    key={`${pos.contract}-${pos.token_id}`}
                    onClick={() => selectVesting(pos)}
                    className="card w-full text-left hover:border-lav/30 transition-all"
                  >
                    <div className="p-4 flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                        pos.platform === 'sablier' ? 'bg-amber/10 text-amber' : 'bg-green/10 text-green'
                      }`}>
                        {pos.platform === 'sablier' ? 'S' : 'H'}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-tx font-medium">#{pos.token_id}</span>
                          <span className={`badge-${pos.status === 'Streaming' ? 'green' : 'lav'}`}>{pos.status}</span>
                        </div>
                        <div className="text-tx3 text-sm">
                          {formatAmount(BigInt(pos.total_amount))} tokens &middot; {formatTime(pos.start_time)} &rarr; {formatTime(pos.end_time)}
                        </div>
                      </div>
                      <span className="text-tx3">&rarr;</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {tab === 'manual' && (
            <div className="card p-5 space-y-4">
              <p className="text-tx3 text-sm">Enter the contract address and token ID of any ERC-721 NFT you own.</p>
              <div>
                <label className="text-tx2 text-sm mb-1.5 block">Contract Address</label>
                <input
                  type="text"
                  value={manualContract}
                  onChange={(e) => setManualContract(e.target.value)}
                  placeholder="0x..."
                  className="form-input font-mono"
                />
              </div>
              <div>
                <label className="text-tx2 text-sm mb-1.5 block">Token ID</label>
                <input
                  type="number"
                  value={manualTokenId}
                  onChange={(e) => setManualTokenId(e.target.value)}
                  placeholder="0"
                  className="form-input"
                />
              </div>
              {manualError && (
                <div className="text-red text-sm">{manualError}</div>
              )}
              <button
                onClick={handleManualAdd}
                disabled={!manualContract || !manualTokenId}
                className="btn btn-primary disabled:opacity-50"
              >
                Verify &amp; Continue
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Set price */}
      {step === 'price' && selected && (
        <div className="space-y-4 fi3">
          <div className="card p-5">
            <div className="text-tx3 text-xs uppercase tracking-wider mb-2">Selected NFT</div>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                selected.type === 'vesting'
                  ? (selected.data as VestingPosition).platform === 'sablier' ? 'bg-amber/10 text-amber' : 'bg-green/10 text-green'
                  : 'bg-ice/10 text-ice'
              }`}>
                {selected.type === 'vesting'
                  ? ((selected.data as VestingPosition).platform === 'sablier' ? 'S' : 'H')
                  : 'N'}
              </div>
              <div>
                <div className="text-tx font-medium">{getSelectedLabel()}</div>
                <div className="text-tx3 text-sm font-mono">{formatAddress(getSelectedContract())}</div>
              </div>
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <div>
              <label className="text-tx2 text-sm mb-1.5 block">Payment Token</label>
              <div className="flex gap-2">
                {(['ETH', 'USDC'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setPaymentToken(t)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                      paymentToken === t ? 'bg-lav/10 text-lav border border-lav/20' : 'bg-bg3 text-tx3 border border-brd'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-tx2 text-sm mb-1.5 block">Listing Price</label>
              <div className="relative">
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.0"
                  className="form-input pr-16"
                  step="0.01"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-tx3 text-sm">{paymentToken}</span>
              </div>
            </div>

            {price && Number(price) > 0 && selected.type === 'vesting' && (
              <div className="bg-bg3 rounded-lg p-3 text-sm">
                <div className="flex justify-between text-tx3">
                  <span>Token Value</span>
                  <span>{formatAmount(BigInt((selected.data as VestingPosition).total_amount))} tokens</span>
                </div>
                <div className="flex justify-between text-tx3 mt-1">
                  <span>Your Price</span>
                  <span>{price} {paymentToken}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setStep('select'); setSelected(null) }} className="btn btn-secondary">
              Back
            </button>
            <button
              onClick={handleApproveAndList}
              disabled={!price || Number(price) <= 0 || !escrowContract}
              className="btn btn-primary flex-1 disabled:opacity-50"
            >
              {!escrowContract ? 'Escrow not configured' : 'Approve & List'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Transaction in progress */}
      {(step === 'approve' || step === 'list') && (
        <div className="card p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-lav/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-lav text-lg">{step === 'approve' ? '1' : '2'}</span>
          </div>
          <p className="text-tx font-medium">{step === 'approve' ? 'Approving NFT' : 'Creating Listing'}</p>
          <p className="text-tx3 text-sm mt-1">{txStatus}</p>
        </div>
      )}
    </div>
  )
}
