'use client'

import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import { api, AccountState } from '@/services/api'

export default function Account() {
  const [address, setAddress] = useState<string | null>(null)
  const [accountState, setAccountState] = useState<AccountState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Get address from window.ethereum
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
      console.error('Error loading account state:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  return (
    <Layout>
      <div className="px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Account</h1>

        {!address ? (
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600">
              Please connect your wallet to view account information
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Account Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Account Information</h2>
              <div className="space-y-2">
                <div>
                  <span className="text-gray-600">Address: </span>
                  <span className="font-mono text-gray-900">{formatAddress(address)}</span>
                </div>
                {accountState && (
                  <>
                    <div>
                      <span className="text-gray-600">Account ID: </span>
                      <span className="font-mono text-gray-900">{accountState.account_id}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Nonce: </span>
                      <span className="text-gray-900">{accountState.nonce}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Balances */}
            {loading ? (
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-gray-600">Loading balances...</p>
              </div>
            ) : error ? (
              <div className="bg-red-50 rounded-lg shadow p-6">
                <p className="text-red-600">Error: {error}</p>
              </div>
            ) : accountState && accountState.balances.length > 0 ? (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Balances</h2>
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
                            {balance.amount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-gray-600">No balances found</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
