'use client'

import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import { api, AccountState } from '@/services/api'
import { ethers } from 'ethers'
import {
  formatAddress,
  formatAmount,
  parseAmount,
  signTransactionCorrect,
} from '@/utils/transactions'
import { ASSETS, AVAILABLE_CHAINS, DEFAULTS, getChainName } from '@/constants/config'

export default function Withdrawals() {
  const [address, setAddress] = useState<string | null>(null)
  const [accountState, setAccountState] = useState<AccountState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [assetId] = useState<number>(ASSETS.ETH.id)
  const [amount, setAmount] = useState<string>('')
  const [to, setTo] = useState<string>('')
  const [chainId, setChainId] = useState<string>(String(DEFAULTS.CHAIN_BASE))

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

      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) {
          setAddress(accounts[0])
          loadAccountState(accounts[0])
        } else {
          setAddress(null)
          setAccountState(null)
        }
      }

      window.ethereum.on('accountsChanged', handleAccountsChanged)
      return () => {
        window.ethereum?.removeListener('accountsChanged', handleAccountsChanged)
      }
    }
  }, [])

  const loadAccountState = async (addr: string) => {
    setLoading(true)
    setError(null)
    try {
      const state = await api.getAccountState(addr)
      setAccountState(state)
    } catch (err: any) {
      setError(err.message || 'Failed to load account state')
    } finally {
      setLoading(false)
    }
  }

  const getBalance = (chainIdNum: number): bigint => {
    if (!accountState) return BigInt(0)
    const b = accountState.balances.find(
      (bal) => bal.asset_id === assetId && bal.chain_id === chainIdNum
    )
    return b ? BigInt(b.amount) : BigInt(0)
  }

  const handleWithdraw = async () => {
    if (!address || !window.ethereum) {
      alert('Please connect your wallet')
      return
    }
    if (!accountState) {
      alert('Please wait for account to load')
      return
    }
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount')
      return
    }
    if (!to || !ethers.isAddress(to)) {
      setError('Please enter a valid recipient address')
      return
    }

    const chainIdNum = parseInt(chainId)
    const amountBigInt = parseAmount(amount)
    const balance = getBalance(chainIdNum)

    if (amountBigInt > balance) {
      setError(
        `Insufficient balance on ${getChainName(chainIdNum)}. ` +
        `Available: ${formatAmount(balance)} ${ASSETS.ETH.symbol}`
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
        to: to,
        chainId: chainIdNum,
      }

      const signature = await signTransactionCorrect(signer, address, nonce, 'Withdraw', payload)

      const submitRequest = {
        kind: 'Withdraw',
        from: address,
        asset_id: assetId,
        amount: amountBigInt.toString(),
        to: to,
        chain_id: chainIdNum,
        nonce: nonce,
        signature: signature,
      }

      await api.submitTransaction(submitRequest)
      setSuccess('Withdrawal submitted! ZK proof will be generated for on-chain verification.')
      setAmount('')
      setTo('')
      await loadAccountState(address)
    } catch (err: any) {
      setError(err.message || 'Failed to process withdrawal')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-xl mx-auto">
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-bold text-bright">Withdraw</h1>
          <p className="text-sm text-dim mt-1">Withdraw settled assets back to their native chain</p>
        </div>

        {!address ? (
          <div className="bg-surface border border-edge rounded-2xl p-8 text-center">
            <p className="text-dim">Connect your wallet to make withdrawals</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Balances Overview */}
            {accountState && accountState.balances.length > 0 && (
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

            {/* Withdrawal Form */}
            <div className="bg-surface border border-edge rounded-2xl p-6">
              <span className="font-mono text-[9px] tracking-[3px] uppercase text-silver-lo mb-5 block">
                New Withdrawal
              </span>

              {error && (
                <div className="mb-5 p-4 bg-danger/5 border border-danger/20 rounded-xl">
                  <p className="text-danger text-sm">{error}</p>
                </div>
              )}

              {success && (
                <div className="mb-5 p-4 bg-success/5 border border-success/20 rounded-xl">
                  <p className="text-success text-sm">{success}</p>
                </div>
              )}

              <div className="space-y-5">
                {/* Chain */}
                <div>
                  <label className="block font-mono text-[10px] tracking-[2px] uppercase text-silver-lo mb-2">
                    Chain
                  </label>
                  <select
                    value={chainId}
                    onChange={(e) => setChainId(e.target.value)}
                  >
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

                {/* Amount */}
                <div>
                  <label className="block font-mono text-[10px] tracking-[2px] uppercase text-silver-lo mb-2">
                    Amount ({ASSETS.ETH.symbol})
                  </label>
                  <input
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.0"
                  />
                </div>

                {/* Recipient */}
                <div>
                  <label className="block font-mono text-[10px] tracking-[2px] uppercase text-silver-lo mb-2">
                    Recipient Address
                  </label>
                  <input
                    type="text"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder="0x..."
                  />
                  <p className="font-mono text-[10px] text-dim mt-1.5">
                    Leave as your address for self-withdrawal
                  </p>
                </div>

                {/* Info */}
                <div className="p-4 bg-info/5 border border-info/20 rounded-xl">
                  <p className="text-info text-xs leading-relaxed">
                    Withdrawals are verified by ZK proofs on-chain. After submission, the transaction will be included in the next block and a proof generated for settlement.
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => window.history.back()}
                    className="btn-outline flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleWithdraw}
                    disabled={loading || !amount || !to}
                    className="btn-silver flex-1"
                  >
                    {loading ? 'Processing...' : 'Withdraw'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
