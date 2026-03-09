'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { api, AccountState } from '@/services/api'
import { formatAmount } from '@/utils/transactions'
import { ASSETS, getChainName } from '@/constants/config'

export default function Account() {
  const [address, setAddress] = useState<string | null>(null)
  const [accountState, setAccountState] = useState<AccountState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const formatAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  const totalBalance = accountState?.balances.reduce(
    (sum, b) => sum + BigInt(b.amount),
    BigInt(0)
  ) ?? BigInt(0)

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-bold text-bright">Account</h1>
          <p className="text-sm text-dim mt-1">View your balances and account details</p>
        </div>

        {!address ? (
          <div className="bg-surface border border-edge rounded-2xl p-8 text-center">
            <p className="text-dim">Connect your wallet to view account information</p>
          </div>
        ) : loading && !accountState ? (
          <div className="bg-surface border border-edge rounded-2xl p-12 text-center">
            <p className="text-dim">Loading account...</p>
          </div>
        ) : error && !accountState ? (
          <div className="bg-danger/5 border border-danger/20 rounded-2xl p-6">
            <p className="text-danger text-sm">{error}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Account Overview */}
            <div className="bg-surface border border-edge rounded-2xl p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <span className="font-mono text-[9px] tracking-[3px] uppercase text-silver-lo">Address</span>
                  <p className="font-mono text-sm text-bright mt-1">{formatAddr(address)}</p>
                  <p className="font-mono text-[10px] text-dim mt-0.5 break-all">{address}</p>
                </div>
                {accountState && (
                  <div className="text-right">
                    <span className="font-mono text-[9px] tracking-[3px] uppercase text-silver-lo">Nonce</span>
                    <p className="font-mono text-sm text-bright mt-1">{accountState.nonce}</p>
                  </div>
                )}
              </div>

              {/* Total Balance */}
              <div className="bg-base border border-edge rounded-xl p-5">
                <span className="font-mono text-[9px] tracking-[3px] uppercase text-silver-lo">Total Balance</span>
                <div className="font-heading text-3xl font-bold text-bright mt-2">
                  {formatAmount(totalBalance)}
                  <span className="text-lg text-dim ml-2">{ASSETS.ETH.symbol}</span>
                </div>
              </div>
            </div>

            {/* Balances by Chain */}
            {accountState && accountState.balances.length > 0 ? (
              <div className="bg-surface border border-edge rounded-2xl p-6">
                <span className="font-mono text-[9px] tracking-[3px] uppercase text-silver-lo mb-4 block">
                  Balances by Chain
                </span>
                <div className="space-y-2">
                  {accountState.balances.map((balance, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-base border border-edge rounded-xl px-5 py-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-heading text-sm font-semibold text-bright">
                            {ASSETS.ETH.symbol}
                          </span>
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-elevated text-dim">
                            ID: {balance.asset_id}
                          </span>
                        </div>
                        <p className="font-mono text-[10px] text-dim mt-1">
                          {getChainName(balance.chain_id)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-lg text-bright">
                          {formatAmount(BigInt(balance.amount))}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : accountState ? (
              <div className="bg-surface border border-edge rounded-2xl p-8 text-center">
                <p className="text-dim mb-4">No balances yet</p>
                <Link href="/deals/create" className="btn-outline text-xs">
                  Create your first deal
                </Link>
              </div>
            ) : null}

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/deals/create"
                className="bg-surface border border-edge rounded-2xl p-5 hover:border-muted transition-all group text-center"
              >
                <span className="font-mono text-[9px] tracking-[3px] uppercase text-silver-lo">New</span>
                <p className="font-heading text-sm font-semibold text-bright mt-2 group-hover:text-silver-hi transition-colors">
                  Create Deal
                </p>
              </Link>
              <Link
                href="/withdrawals"
                className="bg-surface border border-edge rounded-2xl p-5 hover:border-muted transition-all group text-center"
              >
                <span className="font-mono text-[9px] tracking-[3px] uppercase text-silver-lo">Move</span>
                <p className="font-heading text-sm font-semibold text-bright mt-2 group-hover:text-silver-hi transition-colors">
                  Withdraw
                </p>
              </Link>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
