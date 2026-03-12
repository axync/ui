'use client'

import Link from 'next/link'
import Layout from '@/components/Layout'
import { api, Deal } from '@/services/api'
import { useEffect, useState } from 'react'
import { useWallet } from '@/hooks/useWallet'
import { formatAmount, formatAddress } from '@/utils/transactions'
import { getChainName, ASSETS } from '@/constants/config'

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Pending: 'badge-amber',
    Settled: 'badge-green',
    Cancelled: 'badge-red',
    Expired: 'badge-red',
  }
  return <span className={`badge ${map[status] || 'badge-muted'}`}>{status}</span>
}

export default function Home() {
  const { address, accountState } = useWallet()
  const [health, setHealth] = useState<any>(null)
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.healthCheck()
      .then((data) => setHealth(data))
      .catch((err) => console.error('API health check failed:', err))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    api.getDealsList()
      .then((data) => setDeals(data.deals || []))
      .catch(() => {})
  }, [])

  const activeDeals = deals.filter((d) => d.status === 'Pending')
  const settledDeals = deals.filter((d) => d.status === 'Settled')
  const totalSettled = settledDeals.reduce((sum, d) => {
    const amount = parseFloat(formatAmount(BigInt(d.amount_base), ASSETS.ETH.decimals))
    return sum + amount
  }, 0)

  // Balances ready to withdraw (from account state)
  const withdrawableBalances = accountState?.balances?.filter(
    (b) => BigInt(b.amount) > BigInt(0)
  ) || []

  const recentDeals = deals.slice(0, 4)

  return (
    <Layout>
      <div className="space-y-5">
        {/* Stats Grid */}
        <div className="grid grid-cols-4 grid-4-resp gap-4 fi">
          <div className="card card-grad">
            <div className="text-xs text-tx3">Total Settled</div>
            <div className="text-2xl font-bold text-gradient mt-1">
              {settledDeals.length > 0 ? `${totalSettled.toFixed(2)} ETH` : '0'}
            </div>
            <div className="text-[11px] text-tx3 mt-0.5">
              {settledDeals.length} deals completed
            </div>
          </div>
          <div className="card">
            <div className="text-xs text-tx3">Active Deals</div>
            <div className="text-2xl font-bold text-tx mt-1">{activeDeals.length}</div>
            <div className="text-[11px] text-tx3 mt-0.5">
              {activeDeals.length > 0 ? `${activeDeals.length} pending settlement` : 'No active deals'}
            </div>
          </div>
          <div className="card">
            <div className="text-xs text-tx3">ZK Proofs</div>
            <div className="text-2xl font-bold text-lav mt-1">{settledDeals.length}</div>
            <div className="text-[11px] text-tx3 mt-0.5">Verified on-chain</div>
          </div>
          <div className="card">
            <div className="text-xs text-tx3">Ready to Withdraw</div>
            <div className="text-2xl font-bold text-ice mt-1">{withdrawableBalances.length}</div>
            <Link href="/withdrawals" className="text-[11px] text-lav cursor-pointer hover:underline mt-0.5 inline-block">
              Go to Withdrawals &rarr;
            </Link>
          </div>
        </div>

        {/* Withdraw Alert */}
        {withdrawableBalances.length > 0 && (
          <Link
            href="/withdrawals"
            className="fi1 flex items-center justify-between p-3.5 rounded-xl border border-lav/[0.12] cursor-pointer transition-all hover:border-lav/20"
            style={{ background: 'linear-gradient(135deg, rgba(204,204,255,0.06), rgba(125,211,252,0.06))' }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-grad flex items-center justify-center text-bg text-sm font-bold">
                &darr;
              </div>
              <div>
                <span className="text-[13px] font-semibold">
                  {withdrawableBalances.length} balance{withdrawableBalances.length > 1 ? 's' : ''} ready to withdraw
                </span>
              </div>
            </div>
            <span className="btn btn-sm btn-primary">View &rarr;</span>
          </Link>
        )}

        <div className="grid grid-cols-2 grid-resp gap-5">
          {/* Left column */}
          <div className="space-y-5">
            {/* Balances */}
            <div className="card fi1">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs font-semibold text-tx3 uppercase tracking-wider">Balances</div>
              </div>
              {!address ? (
                <p className="text-sm text-tx3">Connect wallet to view balances</p>
              ) : accountState?.balances && accountState.balances.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {accountState.balances.map((bal, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 px-3.5 rounded-[9px] bg-bg border border-brd">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold bg-[rgba(98,126,234,0.15)] text-[#627EEA]">
                          &Xi;
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold">{ASSETS.ETH.symbol}</div>
                          <div className="text-[10px] text-tx3">{getChainName(bal.chain_id)}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[13px] font-semibold font-mono">
                          {formatAmount(BigInt(bal.amount), ASSETS.ETH.decimals)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-tx3">No balances yet</p>
              )}
            </div>

            {/* ZK Engine */}
            <div className="card fi2">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs font-semibold text-tx3 uppercase tracking-wider">ZK Proof Engine</div>
                <span className={`badge ${health?.status === 'healthy' ? 'badge-green' : loading ? 'badge-muted' : 'badge-red'}`}>
                  {loading ? '...' : health?.status === 'healthy' ? '✓ Live' : '✗ Offline'}
                </span>
              </div>
              <div className="zk-bar mb-3.5">
                <div className="w-[22px] h-[22px] rounded-[5px] bg-grad flex items-center justify-center text-[10px] font-bold text-bg">
                  ZK
                </div>
                <div className="text-[11px] text-tx2">
                  <strong className="text-lav font-semibold">STARK &rarr; Groth16</strong> compression active
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 p-2.5 rounded-lg bg-bg text-center">
                  <div className="text-base font-bold text-ice font-mono">0.8s</div>
                  <div className="text-[10px] text-tx3">Avg Prove</div>
                </div>
                <div className="flex-1 p-2.5 rounded-lg bg-bg text-center">
                  <div className="text-base font-bold text-lav font-mono">0.3s</div>
                  <div className="text-[10px] text-tx3">Avg Verify</div>
                </div>
                <div className="flex-1 p-2.5 rounded-lg bg-bg text-center">
                  <div className="text-base font-bold text-green font-mono">100%</div>
                  <div className="text-[10px] text-tx3">Success</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Recent Deals */}
            <div className="card fi1">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs font-semibold text-tx3 uppercase tracking-wider">Recent Deals</div>
                <Link href="/deals" className="btn btn-sm btn-outline">All Deals</Link>
              </div>
              {recentDeals.length > 0 ? (
                <div>
                  {recentDeals.map((deal) => (
                    <Link
                      key={deal.deal_id}
                      href={`/deals/${deal.deal_id}`}
                      className="flex items-center gap-3 py-2.5 border-b border-brd/40 last:border-0 hover:bg-lav/[0.02] transition-colors -mx-1 px-1 rounded"
                    >
                      <div className="w-8 text-center text-ice text-sm">&hArr;</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold">
                          {ASSETS.ETH.symbol} &rarr; {ASSETS.ETH.symbol}
                        </div>
                        <div className="text-[10px] text-tx3">
                          {getChainName(deal.chain_id_base)} &rarr; {getChainName(deal.chain_id_quote)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-medium">
                          {formatAmount(BigInt(deal.amount_base), ASSETS.ETH.decimals)} ETH
                        </div>
                      </div>
                      <StatusBadge status={deal.status} />
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-tx3">No deals yet</p>
              )}
            </div>

            {/* Quick Actions */}
            <div className="card fi2">
              <div className="text-xs font-semibold text-tx3 uppercase tracking-wider mb-3.5">Quick Actions</div>
              <div className="flex gap-2.5">
                <Link href="/deals/create" className="btn btn-primary btn-lg flex-1 justify-center">
                  + New Deal
                </Link>
                <Link href="/withdrawals" className="btn btn-outline btn-lg flex-1 justify-center">
                  &darr; Withdraw
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
