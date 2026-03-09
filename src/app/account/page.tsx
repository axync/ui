'use client'

import Link from 'next/link'
import Layout from '@/components/Layout'
import { useWallet } from '@/hooks/useWallet'
import { formatAmount } from '@/utils/transactions'
import { ASSETS, getChainName } from '@/constants/config'

export default function Account() {
  const { address, accountState, loading, walletInstalled } = useWallet()

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
              Click &quot;Connect Wallet&quot; in the top right to get started.
            </p>
          </div>
        ) : loading && !accountState ? (
          <div className="bg-surface border border-edge rounded-2xl p-12 text-center">
            <div className="w-8 h-8 mx-auto border-2 border-silver-lo border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-dim">Loading account...</p>
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
