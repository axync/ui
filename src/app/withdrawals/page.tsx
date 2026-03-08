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

export default function Withdrawals() {
  const [address, setAddress] = useState<string | null>(null)
  const [accountState, setAccountState] = useState<AccountState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [assetId, setAssetId] = useState<string>('1')
  const [amount, setAmount] = useState<string>('')
  const [to, setTo] = useState<string>('')
  const [chainId, setChainId] = useState<string>('8453') // Base
  const [supportedChains, setSupportedChains] = useState<any[]>([])

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

      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length > 0) {
          setAddress(accounts[0])
          loadAccountState(accounts[0])
        } else {
          setAddress(null)
          setAccountState(null)
        }
      })
    }

    api
      .getSupportedChains()
      .then((data: any) => {
        setSupportedChains(data.chains || [])
      })
      .catch(console.error)
  }, [])

  const loadAccountState = async (addr: string) => {
    setLoading(true)
    setError(null)
    try {
      const state = await api.getAccountState(addr)
      setAccountState(state)
    } catch (err: any) {
      setError(err.message || 'Failed to load account state')
      console.error('Error loading account state:', err)
    } finally {
      setLoading(false)
    }
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
      alert('Please enter a valid amount')
      return
    }

    if (!to || !ethers.isAddress(to)) {
      alert('Please enter a valid recipient address')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()

      const assetIdNum = parseInt(assetId)
      const chainIdNum = parseInt(chainId)
      const amountBigInt = parseAmount(amount)
      const nonce = accountState.nonce

      // Create transaction payload for signing
      const payload = {
        assetId: assetIdNum,
        amount: amountBigInt.toString(),
        to: to,
        chainId: chainIdNum,
      }

      // Sign transaction
      const signature = await signTransactionCorrect(
        signer,
        address,
        nonce,
        'Withdraw',
        payload
      )

      // Submit transaction
      const submitRequest = {
        kind: 'Withdraw',
        from: address,
        asset_id: assetIdNum,
        amount: amountBigInt.toString(),
        to: to,
        chain_id: chainIdNum,
        nonce: nonce,
        signature: signature,
      }

      const result = await api.submitTransaction(submitRequest)
      alert(`Withdrawal submitted successfully!\nTransaction Hash: ${result.tx_hash}`)

      // Reload account state
      await loadAccountState(address)
    } catch (err: any) {
      setError(err.message || 'Failed to process withdrawal')
      console.error('Error processing withdrawal:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Withdrawals</h1>

        {!address ? (
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600">
              Please connect your wallet to make withdrawals
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Account Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Account</h2>
              <div className="space-y-2">
                <div>
                  <span className="text-gray-600">Address: </span>
                  <span className="font-mono text-gray-900">{formatAddress(address)}</span>
                </div>
                {accountState && (
                  <div>
                    <span className="text-gray-600">Nonce: </span>
                    <span className="text-gray-900">{accountState.nonce}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Withdrawal Form */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">New Withdrawal</h2>
              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-red-600">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Asset ID
                  </label>
                  <input
                    type="number"
                    value={assetId}
                    onChange={(e) => setAssetId(e.target.value)}
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount
                  </label>
                  <input
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Recipient Address
                  </label>
                  <input
                    type="text"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Chain ID
                  </label>
                  <select
                    value={chainId}
                    onChange={(e) => setChainId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {supportedChains.map((chain) => (
                      <option key={chain.chain_id} value={chain.chain_id}>
                        {chain.name} ({chain.chain_id})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleWithdraw}
                  disabled={loading || !amount || !to}
                  className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Processing...' : 'Withdraw'}
                </button>
              </div>

              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Withdrawals require ZK proof verification
                  on-chain. After submission, the transaction will be included in
                  the next block and a proof will be generated.
                </p>
              </div>
            </div>

            {/* Current Balances */}
            {accountState && accountState.balances.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Available Balances</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Asset ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Chain ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {accountState.balances.map((balance, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {balance.asset_id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {balance.chain_id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatAmount(BigInt(balance.amount))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
