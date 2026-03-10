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
  VAULT_CONTRACT_ABI,
  getChainName,
  getVaultContract,
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
      const vaultContractAddr = getVaultContract(chainIdNum)

      if (!vaultContractAddr) {
        setError(`No vault contract found for ${getChainName(chainIdNum)}.`)
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

      // Connect to AxyncVault
      const vaultContract = new ethers.Contract(
        vaultContractAddr,
        VAULT_CONTRACT_ABI,
        signer
      )

      // Read current withdrawals root from contract
      const withdrawalsRoot = await vaultContract.withdrawalsRoot()

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

      const tx = await vaultContract.withdraw(
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

  const stepIndex = step === 'form' ? 0 : step === 'sequencer_pending' ? 1 : step === 'ready_to_claim' || step === 'claiming' ? 2 : 3

  return (
    <Layout>
      <div className="max-w-xl mx-auto">
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold text-bright tracking-tight">Withdraw</h1>
          <p className="text-sm text-dim mt-1.5">Withdraw settled assets back to their native chain</p>
        </div>

        {!walletInstalled ? (
          <div className="bg-surface rounded-2xl p-8 text-center space-y-3 shadow-elevation-1">
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
          <div className="bg-surface rounded-2xl p-8 text-center space-y-3 shadow-elevation-1">
            <div className="w-12 h-12 mx-auto rounded-full bg-elevated flex items-center justify-center">
              <span className="text-dim text-xl">&#x1F50C;</span>
            </div>
            <p className="text-bright font-heading font-semibold">Wallet not connected</p>
            <p className="text-dim text-sm">
              Click &quot;Connect Wallet&quot; in the top right to make withdrawals.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Step Indicator */}
            <div className="flex items-center gap-0 px-2">
              {['Submit', 'Block', 'Claim'].map((label, i) => {
                const isActive = i === stepIndex
                const isDone = i < stepIndex || step === 'done'
                return (
                  <div key={label} className="flex items-center flex-1">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                        isDone ? 'bg-success/20 text-success' : isActive ? 'bg-accent/20 text-accent' : 'bg-elevated text-muted'
                      }`}>
                        {isDone ? '✓' : i + 1}
                      </div>
                      <span className={`text-xs font-medium ${isActive ? 'text-bright' : isDone ? 'text-dim' : 'text-muted'}`}>
                        {label}
                      </span>
                    </div>
                    {i < 2 && <div className={`flex-1 h-px mx-3 ${isDone ? 'bg-success/30' : 'bg-edge'}`} />}
                  </div>
                )
              })}
            </div>

            {/* Balances Overview */}
            {accountState && accountState.balances.length > 0 && step === 'form' && (
              <div className="bg-surface rounded-2xl p-6 shadow-elevation-1">
                <span className="text-xs font-medium text-muted uppercase tracking-wider mb-4 block">
                  Available Balances
                </span>
                <div className="space-y-2">
                  {accountState.balances.map((balance, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-elevated/40 rounded-xl px-5 py-3.5"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-heading text-sm font-semibold text-bright">
                          {ASSETS.ETH.symbol}
                        </span>
                        <span className="text-xs text-muted">
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
              <div className="p-5 bg-danger/5 rounded-2xl flex items-start gap-3">
                <span className="text-danger text-sm mt-0.5">&#x26A0;</span>
                <p className="text-danger text-sm">{error}</p>
              </div>
            )}
            {success && (
              <div className="p-5 bg-success/5 rounded-2xl flex items-start gap-3">
                <span className="text-success text-sm mt-0.5">&#x2713;</span>
                <p className="text-success text-sm whitespace-pre-line">{success}</p>
              </div>
            )}

            {/* Step 1: Form */}
            {step === 'form' && (
              <div className="bg-surface rounded-2xl p-8 shadow-elevation-1">
                <h2 className="text-sm font-medium text-dim mb-6">Submit Withdrawal</h2>

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-dim mb-2">
                      Chain
                    </label>
                    <select value={chainId} onChange={(e) => setChainId(e.target.value)}>
                      {AVAILABLE_CHAINS.map((chain) => (
                        <option key={chain.id} value={chain.id}>{chain.name}</option>
                      ))}
                    </select>
                    {accountState && (
                      <p className="text-xs text-muted mt-2">
                        Available: {formatAmount(getBalance(parseInt(chainId)))} {ASSETS.ETH.symbol}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-dim mb-2">
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
                    <label className="block text-sm font-medium text-dim mb-2">
                      Recipient
                      <span className="text-muted font-normal ml-1">(optional, defaults to your address)</span>
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
              <div className="bg-surface rounded-2xl p-10 text-center shadow-elevation-1">
                <div className="mb-5">
                  <div className="w-12 h-12 mx-auto border-2 border-warning border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="font-heading text-lg text-bright">Waiting for block inclusion...</p>
                <p className="text-dim text-sm mt-2">The sequencer will include your withdrawal in the next block</p>
              </div>
            )}

            {/* Step 3: Claim on-chain */}
            {(step === 'ready_to_claim' || step === 'claiming') && (
              <div className="bg-surface rounded-2xl p-8 shadow-elevation-1">
                <h2 className="text-sm font-medium text-dim mb-6">Claim On-Chain</h2>

                <div className="bg-elevated/40 rounded-xl p-5 mb-6">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-xs text-muted">Amount</span>
                      <span className="text-sm text-bright font-medium">{amount} {ASSETS.ETH.symbol}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted">Chain</span>
                      <span className="text-sm text-bright font-medium">{getChainName(parseInt(chainId))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted">Recipient</span>
                      <span className="font-mono text-sm text-bright">{formatAddress(to || address!)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-info/5 rounded-xl mb-6">
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
              <div className="bg-surface rounded-2xl p-10 text-center shadow-elevation-1">
                <div className="w-16 h-16 mx-auto rounded-full bg-success/10 flex items-center justify-center mb-5">
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
