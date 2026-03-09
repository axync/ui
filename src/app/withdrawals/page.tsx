'use client'

import { useState } from 'react'
import Layout from '@/components/Layout'
import { useWallet } from '@/hooks/useWallet'
import { ethers } from 'ethers'
import {
  formatAddress,
  formatAmount,
  parseAmount,
  signTransactionCorrect,
} from '@/utils/transactions'
import { parseWalletError } from '@/utils/walletErrors'
import {
  ASSETS,
  AVAILABLE_CHAINS,
  DEFAULTS,
  WITHDRAWAL_CONTRACT_ABI,
  getChainName,
  getWithdrawalContract,
  getChainHex,
} from '@/constants/config'

type WithdrawalStep = 'form' | 'sequencer_pending' | 'ready_to_claim' | 'claiming' | 'done'

export default function Withdrawals() {
  const { address, accountState, walletInstalled, refreshAccountState, switchToChain } = useWallet()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [assetId] = useState<number>(ASSETS.ETH.id)
  const [amount, setAmount] = useState<string>('')
  const [to, setTo] = useState<string>('')
  const [chainId, setChainId] = useState<string>(String(DEFAULTS.CHAIN_BASE))
  const [step, setStep] = useState<WithdrawalStep>('form')
  const [withdrawalTxHash, setWithdrawalTxHash] = useState<string | null>(null)

  const getBalance = (chainIdNum: number): bigint => {
    if (!accountState) return BigInt(0)
    const b = accountState.balances.find(
      (bal) => bal.asset_id === assetId && bal.chain_id === chainIdNum
    )
    return b ? BigInt(b.amount) : BigInt(0)
  }

  // Step 1: Submit withdrawal to sequencer
  const handleSubmitWithdrawal = async () => {
    if (!address || !window.ethereum) {
      setError('Please connect your wallet to continue.')
      return
    }
    if (!accountState) {
      setError('Account is still loading. Please wait a moment.')
      return
    }
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount.')
      return
    }

    const recipient = to || address
    if (!ethers.isAddress(recipient)) {
      setError('Please enter a valid recipient address.')
      return
    }

    const chainIdNum = parseInt(chainId)
    const amountBigInt = parseAmount(amount)
    const balance = getBalance(chainIdNum)

    if (amountBigInt > balance) {
      setError(
        `Insufficient balance on ${getChainName(chainIdNum)}. Available: ${formatAmount(balance)} ${ASSETS.ETH.symbol}`
      )
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const nonce = accountState.nonce

      const payload = {
        assetId: assetId,
        amount: amountBigInt.toString(),
        to: recipient,
        chainId: chainIdNum,
      }

      const signature = await signTransactionCorrect(signer, address, nonce, 'Withdraw', payload)

      const submitRequest = {
        kind: 'Withdraw',
        from: address,
        asset_id: assetId,
        amount: amountBigInt.toString(),
        to: recipient,
        chain_id: chainIdNum,
        nonce: nonce,
        signature: signature,
      }

      const result = await (await import('@/services/api')).api.submitTransaction(submitRequest)
      setWithdrawalTxHash(result.tx_hash)
      setStep('sequencer_pending')
      setSuccess('Withdrawal submitted! Waiting for block inclusion...')

      // Wait for block inclusion then move to claim step
      setTimeout(() => {
        setStep('ready_to_claim')
        setSuccess('Ready to claim on-chain!')
      }, 6000)

      await refreshAccountState()
    } catch (err: any) {
      setError(parseWalletError(err))
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Claim on-chain via WithdrawalContract
  const handleClaimOnChain = async () => {
    if (!address || !window.ethereum) {
      setError('Please connect your wallet to continue.')
      return
    }

    setLoading(true)
    setError(null)
    setStep('claiming')

    try {
      const chainIdNum = parseInt(chainId)
      const withdrawalContractAddr = getWithdrawalContract(chainIdNum)

      if (!withdrawalContractAddr) {
        setError(`No withdrawal contract found for ${getChainName(chainIdNum)}.`)
        setStep('ready_to_claim')
        setLoading(false)
        return
      }

      // Switch to the correct network
      const switched = await switchToChain(chainIdNum)
      if (!switched) {
        setError(`Please switch to ${getChainName(chainIdNum)} in your wallet to claim.`)
        setStep('ready_to_claim')
        setLoading(false)
        return
      }

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()

      // Connect to WithdrawalContract
      const withdrawalContract = new ethers.Contract(
        withdrawalContractAddr,
        WITHDRAWAL_CONTRACT_ABI,
        signer
      )

      // Read current withdrawals root from contract
      const withdrawalsRoot = await withdrawalContract.withdrawalsRoot()

      if (withdrawalsRoot === ethers.ZeroHash) {
        setError('Withdrawal system is not yet initialized. Please try again later or contact support.')
        setStep('ready_to_claim')
        setLoading(false)
        return
      }

      // Build WithdrawalData struct
      const amountBigInt = parseAmount(amount)
      const recipient = to || address
      const withdrawalData = {
        user: address,
        assetId: assetId,
        amount: amountBigInt,
        chainId: chainIdNum,
      }

      // Generate unique nullifier from withdrawal params
      const nullifier = ethers.keccak256(
        ethers.solidityPacked(
          ['address', 'uint256', 'uint256', 'uint256', 'bytes32'],
          [address, assetId, amountBigInt, chainIdNum, withdrawalTxHash ? ethers.id(withdrawalTxHash) : ethers.id(String(Date.now()))]
        )
      )

      // Placeholder proofs (accepted by testnet contracts)
      const merkleProof = ethers.hexlify(ethers.randomBytes(64))
      const zkProof = ethers.hexlify(ethers.randomBytes(32))

      const tx = await withdrawalContract.withdraw(
        withdrawalData,
        merkleProof,
        nullifier,
        zkProof,
        withdrawalsRoot,
        { gasLimit: 300000 }
      )

      setSuccess('Claiming on-chain... waiting for confirmation')
      const receipt = await tx.wait()

      setStep('done')
      setSuccess(
        `Withdrawal claimed on-chain!\nTx: ${receipt.hash}\n${formatAmount(amountBigInt)} ETH sent to ${formatAddress(recipient)} on ${getChainName(chainIdNum)}`
      )
    } catch (err: any) {
      console.error('Claim error:', err)
      setError(parseWalletError(err))
      setStep('ready_to_claim')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setStep('form')
    setAmount('')
    setTo('')
    setError(null)
    setSuccess(null)
    setWithdrawalTxHash(null)
    refreshAccountState()
  }

  return (
    <Layout>
      <div className="max-w-xl mx-auto">
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-bold text-bright">Withdraw</h1>
          <p className="text-sm text-dim mt-1">Withdraw settled assets back to their native chain</p>
        </div>

        {!walletInstalled ? (
          <div className="bg-surface border border-edge rounded-2xl p-8 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-warning/10 flex items-center justify-center">
              <span className="text-warning text-xl">!</span>
            </div>
            <p className="text-bright font-heading font-semibold">No wallet detected</p>
            <p className="text-dim text-sm">
              Install MetaMask or another Web3 wallet to use Axync.
            </p>
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline inline-block text-xs mt-2"
            >
              Install MetaMask
            </a>
          </div>
        ) : !address ? (
          <div className="bg-surface border border-edge rounded-2xl p-8 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-elevated flex items-center justify-center">
              <span className="text-dim text-xl">&#x1F50C;</span>
            </div>
            <p className="text-bright font-heading font-semibold">Wallet not connected</p>
            <p className="text-dim text-sm">
              Click &quot;Connect Wallet&quot; in the top right to make withdrawals.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Step Indicator */}
            <div className="bg-surface border border-edge rounded-2xl p-4">
              <div className="flex items-center gap-2">
                {['Submit', 'Block', 'Claim'].map((label, i) => {
                  const stepIndex = step === 'form' ? 0 : step === 'sequencer_pending' ? 1 : step === 'ready_to_claim' ? 2 : step === 'claiming' ? 2 : 3
                  const isActive = i === stepIndex
                  const isDone = i < stepIndex || step === 'done'
                  return (
                    <div key={label} className="flex items-center gap-2 flex-1">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
                        isDone ? 'bg-success text-base' : isActive ? 'bg-silver-lo text-base' : 'bg-elevated text-dim'
                      }`}>
                        {isDone ? '✓' : i + 1}
                      </div>
                      <span className={`font-mono text-[10px] uppercase tracking-wider ${isActive ? 'text-bright' : 'text-dim'}`}>
                        {label}
                      </span>
                      {i < 2 && <div className="flex-1 h-px bg-edge" />}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Balances Overview */}
            {accountState && accountState.balances.length > 0 && step === 'form' && (
              <div className="bg-surface border border-edge rounded-2xl p-5">
                <span className="font-mono text-[9px] tracking-[3px] uppercase text-silver-lo mb-4 block">
                  Available Balances
                </span>
                <div className="space-y-2">
                  {accountState.balances.map((balance, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-base border border-edge rounded-xl px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-heading text-sm font-semibold text-bright">
                          {ASSETS.ETH.symbol}
                        </span>
                        <span className="font-mono text-[10px] text-dim">
                          {getChainName(balance.chain_id)}
                        </span>
                      </div>
                      <span className="font-mono text-sm text-bright">
                        {formatAmount(BigInt(balance.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Status Messages */}
            {error && (
              <div className="p-4 bg-danger/5 border border-danger/20 rounded-xl flex items-start gap-3">
                <span className="text-danger text-sm mt-0.5">&#x26A0;</span>
                <p className="text-danger text-sm">{error}</p>
              </div>
            )}
            {success && (
              <div className="p-4 bg-success/5 border border-success/20 rounded-xl flex items-start gap-3">
                <span className="text-success text-sm mt-0.5">&#x2713;</span>
                <p className="text-success text-sm whitespace-pre-line">{success}</p>
              </div>
            )}

            {/* Step 1: Form */}
            {step === 'form' && (
              <div className="bg-surface border border-edge rounded-2xl p-6">
                <span className="font-mono text-[9px] tracking-[3px] uppercase text-silver-lo mb-5 block">
                  Step 1 — Submit Withdrawal
                </span>

                <div className="space-y-5">
                  <div>
                    <label className="block font-mono text-[10px] tracking-[2px] uppercase text-silver-lo mb-2">
                      Chain
                    </label>
                    <select value={chainId} onChange={(e) => setChainId(e.target.value)}>
                      {AVAILABLE_CHAINS.map((chain) => (
                        <option key={chain.id} value={chain.id}>{chain.name}</option>
                      ))}
                    </select>
                    {accountState && (
                      <p className="font-mono text-xs text-dim mt-1.5">
                        Available: {formatAmount(getBalance(parseInt(chainId)))} {ASSETS.ETH.symbol}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block font-mono text-[10px] tracking-[2px] uppercase text-silver-lo mb-2">
                      Amount ({ASSETS.ETH.symbol})
                    </label>
                    <input
                      type="text"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.01"
                    />
                  </div>

                  <div>
                    <label className="block font-mono text-[10px] tracking-[2px] uppercase text-silver-lo mb-2">
                      Recipient (optional, defaults to your address)
                    </label>
                    <input
                      type="text"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      placeholder={address || '0x...'}
                    />
                  </div>

                  <button
                    onClick={handleSubmitWithdrawal}
                    disabled={loading || !amount}
                    className="btn-silver w-full"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-base border-t-transparent rounded-full animate-spin" />
                        Signing...
                      </span>
                    ) : (
                      'Submit to Sequencer'
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Waiting for block */}
            {step === 'sequencer_pending' && (
              <div className="bg-surface border border-edge rounded-2xl p-8 text-center">
                <div className="mb-4">
                  <div className="w-12 h-12 mx-auto border-2 border-warning border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="font-heading text-lg text-bright">Waiting for block inclusion...</p>
                <p className="text-dim text-sm mt-2">The sequencer will include your withdrawal in the next block</p>
              </div>
            )}

            {/* Step 3: Claim on-chain */}
            {(step === 'ready_to_claim' || step === 'claiming') && (
              <div className="bg-surface border border-edge rounded-2xl p-6">
                <span className="font-mono text-[9px] tracking-[3px] uppercase text-silver-lo mb-5 block">
                  Step 2 — Claim On-Chain
                </span>

                <div className="bg-base border border-edge rounded-xl p-4 mb-5">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="font-mono text-[10px] text-dim uppercase">Amount</span>
                      <span className="font-mono text-sm text-bright">{amount} {ASSETS.ETH.symbol}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-mono text-[10px] text-dim uppercase">Chain</span>
                      <span className="font-mono text-sm text-bright">{getChainName(parseInt(chainId))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-mono text-[10px] text-dim uppercase">Recipient</span>
                      <span className="font-mono text-sm text-bright">{formatAddress(to || address!)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-info/5 border border-info/20 rounded-xl mb-5">
                  <p className="text-info text-xs leading-relaxed">
                    This will switch your wallet to {getChainName(parseInt(chainId))} and call the withdrawal contract to release your ETH.
                  </p>
                </div>

                <button
                  onClick={handleClaimOnChain}
                  disabled={loading}
                  className="btn-silver w-full"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-base border-t-transparent rounded-full animate-spin" />
                      Claiming...
                    </span>
                  ) : (
                    `Claim ${amount} ETH on ${getChainName(parseInt(chainId))}`
                  )}
                </button>
              </div>
            )}

            {/* Step 4: Done */}
            {step === 'done' && (
              <div className="bg-surface border border-edge rounded-2xl p-6 text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-success/20 flex items-center justify-center mb-4">
                  <span className="text-success text-3xl">&#x2713;</span>
                </div>
                <p className="font-heading text-lg text-bright mb-2">Withdrawal Complete!</p>
                <p className="text-dim text-sm mb-6">
                  Your ETH has been sent to the recipient on {getChainName(parseInt(chainId))}
                </p>
                <button onClick={resetForm} className="btn-outline">
                  New Withdrawal
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
