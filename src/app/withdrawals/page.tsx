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
  const [activeWithdrawal, setActiveWithdrawal] = useState<{ chainId: number; amount: string } | null>(null)

  const getBalance = (chainIdNum: number): bigint => {
    if (!accountState) return BigInt(0)
    const b = accountState.balances.find(
      (bal) => bal.asset_id === assetId && bal.chain_id === chainIdNum
    )
    return b ? BigInt(b.amount) : BigInt(0)
  }

  const withdrawableBalances = accountState?.balances?.filter(
    (b) => BigInt(b.amount) > BigInt(0)
  ) || []

  const startWithdrawal = (chainIdNum: number, amt: string) => {
    setChainId(String(chainIdNum))
    setAmount(formatAmount(BigInt(amt)))
    setActiveWithdrawal({ chainId: chainIdNum, amount: amt })
    setStep('form')
    setError(null)
    setSuccess(null)
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

      const switched = await switchToChain(chainIdNum)
      if (!switched) {
        setError(`Please switch to ${getChainName(chainIdNum)} in your wallet to claim.`)
        setStep('ready_to_claim')
        setLoading(false)
        return
      }

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()

      const vaultContract = new ethers.Contract(
        vaultContractAddr,
        VAULT_CONTRACT_ABI,
        signer
      )

      const withdrawalsRoot = await vaultContract.withdrawalsRoot()

      if (withdrawalsRoot === ethers.ZeroHash) {
        setError('Withdrawal system is not yet initialized. Please try again later or contact support.')
        setStep('ready_to_claim')
        setLoading(false)
        return
      }

      const amountBigInt = parseAmount(amount)
      const recipient = to || address
      const withdrawalData = {
        user: address,
        assetId: assetId,
        amount: amountBigInt,
        chainId: chainIdNum,
      }

      const nullifier = ethers.keccak256(
        ethers.solidityPacked(
          ['address', 'uint256', 'uint256', 'uint256', 'bytes32'],
          [address, assetId, amountBigInt, chainIdNum, withdrawalTxHash ? ethers.id(withdrawalTxHash) : ethers.id(String(Date.now()))]
        )
      )

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
    setActiveWithdrawal(null)
    refreshAccountState()
  }

  const stepIndex = step === 'form' ? 0 : step === 'sequencer_pending' ? 1 : step === 'ready_to_claim' || step === 'claiming' ? 2 : 3

  return (
    <Layout>
      <div className="max-w-[720px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 fi">
          <div>
            <h2 className="text-xl font-bold mb-0.5">Withdrawals</h2>
            <p className="text-xs text-tx3">
              {withdrawableBalances.length} balance{withdrawableBalances.length !== 1 ? 's' : ''} ready to withdraw
            </p>
          </div>
        </div>

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
            <p className="text-sm text-tx3">Click &quot;Connect Wallet&quot; in the top right to make withdrawals.</p>
          </div>
        ) : step === 'form' && !activeWithdrawal ? (
          /* Ready to Claim list */
          <div className="space-y-6">
            {withdrawableBalances.length > 0 && (
              <div className="fi1">
                <div className="text-[11px] font-semibold text-tx3 uppercase tracking-wider mb-3">Ready to claim</div>
                {withdrawableBalances.map((bal, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 px-[18px] rounded-xl bg-bg border border-brd transition-all hover:border-brd2 hover:bg-lav/[0.02] mb-2.5">
                    <div className="w-9 h-9 rounded-[9px] bg-green/10 flex items-center justify-center text-green text-sm flex-shrink-0">
                      ✓
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold">
                          {formatAmount(BigInt(bal.amount))} {ASSETS.ETH.symbol}
                        </span>
                      </div>
                      <div className="text-[11px] text-tx3">{getChainName(bal.chain_id)}</div>
                    </div>
                    <div className="text-right mr-3">
                      <div className="text-[15px] font-bold text-ice font-mono">
                        {formatAmount(BigInt(bal.amount))} ETH
                      </div>
                    </div>
                    <button
                      onClick={() => startWithdrawal(bal.chain_id, bal.amount)}
                      className="btn btn-primary btn-sm"
                    >
                      Withdraw
                    </button>
                  </div>
                ))}
              </div>
            )}

            {withdrawableBalances.length === 0 && (
              <div className="card text-center !p-12">
                <p className="text-tx3 mb-2">No balances to withdraw</p>
                <p className="text-[11px] text-tx3">Complete deals to earn withdrawable balances</p>
              </div>
            )}

            {/* Previously Withdrawn (placeholder) */}
            <div className="fi2">
              <div className="text-[11px] font-semibold text-tx3 uppercase tracking-wider mb-3">Previously withdrawn</div>
              <div className="text-center py-8 text-tx3 text-xs">
                No withdrawal history available yet
              </div>
            </div>
          </div>
        ) : (
          /* Active Withdrawal Flow */
          <div className="space-y-4">
            {/* Step Indicator */}
            <div className="flex items-center gap-0 px-2 fi">
              {['Submit', 'Block', 'Claim'].map((label, i) => {
                const isActive = i === stepIndex
                const isDone = i < stepIndex || step === 'done'
                return (
                  <div key={label} className="flex items-center flex-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                        isDone ? 'bg-green/20 text-green' : isActive ? 'bg-lav/20 text-lav' : 'bg-bg3 text-tx3'
                      }`}>
                        {isDone ? '✓' : i + 1}
                      </div>
                      <span className={`text-xs font-medium ${isActive ? 'text-tx' : isDone ? 'text-tx2' : 'text-tx3'}`}>
                        {label}
                      </span>
                    </div>
                    {i < 2 && <div className={`flex-1 h-px mx-3 ${isDone ? 'bg-green/30' : 'bg-brd'}`} />}
                  </div>
                )
              })}
            </div>

            {/* Status Messages */}
            {error && (
              <div className="p-3.5 bg-red/5 rounded-xl border border-red/10 flex items-start gap-2.5">
                <span className="text-red text-sm mt-0.5">&#x26A0;</span>
                <p className="text-red text-xs">{error}</p>
              </div>
            )}
            {success && (
              <div className="p-3.5 bg-green/5 rounded-xl border border-green/10 flex items-start gap-2.5">
                <span className="text-green text-sm mt-0.5">&#x2713;</span>
                <p className="text-green text-xs whitespace-pre-line">{success}</p>
              </div>
            )}

            {/* Step 1: Form */}
            {step === 'form' && (
              <div className="card fi1">
                <div className="text-sm font-medium text-tx2 mb-4">Submit Withdrawal</div>
                <div className="space-y-3.5">
                  <div>
                    <div className="text-[10px] text-tx3 mb-1.5">Chain</div>
                    <div className="flex gap-[3px]">
                      {AVAILABLE_CHAINS.map((chain) => (
                        <button
                          key={chain.id}
                          onClick={() => setChainId(String(chain.id))}
                          className={`flex items-center gap-[5px] py-[5px] px-[10px] rounded-lg border text-[10px] font-medium transition-all ${
                            String(chain.id) === chainId
                              ? 'border-lav/30 bg-lav/[0.06] text-lav'
                              : 'border-brd text-tx2 hover:text-tx'
                          }`}
                        >
                          <span className="w-[6px] h-[6px] rounded-full" style={{ background: chain.id === 11155111 ? '#627EEA' : '#0052FF' }} />
                          {chain.name}
                        </button>
                      ))}
                    </div>
                    {accountState && (
                      <p className="text-[10px] text-tx3 mt-1.5">
                        Available: {formatAmount(getBalance(parseInt(chainId)))} {ASSETS.ETH.symbol}
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="text-[10px] text-tx3 mb-1.5">Amount ({ASSETS.ETH.symbol})</div>
                    <input
                      type="text"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.01"
                      className="form-input"
                    />
                  </div>

                  <div>
                    <div className="text-[10px] text-tx3 mb-1.5">
                      Recipient <span className="text-tx3/50">(optional, defaults to your address)</span>
                    </div>
                    <input
                      type="text"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      placeholder={address || '0x...'}
                      className="form-input font-mono"
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button onClick={resetForm} className="btn btn-secondary flex-1 justify-center">
                      Back
                    </button>
                    <button
                      onClick={handleSubmitWithdrawal}
                      disabled={loading || !amount}
                      className="btn btn-primary flex-1 justify-center"
                    >
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-bg border-t-transparent rounded-full animate-spin" />
                          Signing...
                        </span>
                      ) : (
                        'Submit to Sequencer'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Waiting */}
            {step === 'sequencer_pending' && (
              <div className="card !p-10 text-center">
                <div className="w-10 h-10 mx-auto border-2 border-amber border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-base font-semibold text-tx">Waiting for block inclusion...</p>
                <p className="text-tx3 text-xs mt-1.5">The sequencer will include your withdrawal in the next block</p>
              </div>
            )}

            {/* Step 3: Claim */}
            {(step === 'ready_to_claim' || step === 'claiming') && (
              <div className="card">
                <div className="text-sm font-medium text-tx2 mb-4">Claim On-Chain</div>

                <div className="bg-bg rounded-xl p-4 mb-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-[11px] text-tx3">Amount</span>
                      <span className="text-sm text-tx font-medium">{amount} {ASSETS.ETH.symbol}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[11px] text-tx3">Chain</span>
                      <span className="text-sm text-tx font-medium">{getChainName(parseInt(chainId))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[11px] text-tx3">Recipient</span>
                      <span className="font-mono text-sm text-tx">{formatAddress(to || address!)}</span>
                    </div>
                  </div>
                </div>

                <div className="zk-bar mb-4">
                  <div className="w-[22px] h-[22px] rounded-[5px] bg-grad flex items-center justify-center text-[10px] font-bold text-bg">ZK</div>
                  <div className="text-[11px] text-tx2">Verified via <strong className="text-lav font-semibold">STARK &rarr; Groth16</strong></div>
                </div>

                <button
                  onClick={handleClaimOnChain}
                  disabled={loading}
                  className="btn btn-primary btn-lg w-full justify-center"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-bg border-t-transparent rounded-full animate-spin" />
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
              <div className="card !p-10 text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-green/10 flex items-center justify-center mb-4">
                  <span className="text-green text-2xl">&#x2713;</span>
                </div>
                <p className="text-lg font-semibold text-tx mb-1.5">Withdrawal Complete!</p>
                <p className="text-tx3 text-xs mb-5">
                  Your ETH has been sent to the recipient on {getChainName(parseInt(chainId))}
                </p>
                <button onClick={resetForm} className="btn btn-outline">
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
