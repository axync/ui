'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { api, Deal } from '@/services/api'
import { formatAddress, formatAmount } from '@/utils/transactions'
import { getChainName } from '@/constants/config'

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Pending: 'bg-warning/10 text-warning',
    Settled: 'bg-success/10 text-success',
    Cancelled: 'bg-danger/10 text-danger',
    Expired: 'bg-muted/20 text-dim',
  }
  return (
    <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${styles[status] || styles.Expired}`}>
      {status}
    </span>
  )
}

export default function Deals() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'my' | 'pending' | 'settled'>('all')

  useEffect(() => {
    loadDeals()
  }, [filter])

  const loadDeals = async () => {
    setLoading(true)
    setError(null)
    try {
      const params: any = {}
      if (filter === 'pending') params.status = 'Pending'
      else if (filter === 'settled') params.status = 'Settled'
      const response = await api.getDealsList(params)
      setDeals(response.deals)
    } catch (err: any) {
      setError(err.message || 'Failed to load deals')
    } finally {
      setLoading(false)
    }
  }

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'my', label: 'My Deals' },
    { key: 'pending', label: 'Pending' },
    { key: 'settled', label: 'Settled' },
  ] as const

  return (
    <Layout>
      <div>
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="font-heading text-3xl font-bold text-bright tracking-tight">Deals</h1>
            <p className="text-sm text-dim mt-1.5">Browse and manage cross-chain settlements</p>
          </div>
          <Link href="/deals/create" className="btn-silver">
            New Deal
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-1 mb-8 bg-surface rounded-xl p-1 w-fit shadow-elevation-1">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === f.key
                  ? 'bg-elevated text-bright shadow-elevation-1'
                  : 'text-muted hover:text-dim'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-surface rounded-2xl p-16 text-center shadow-elevation-1">
            <div className="w-6 h-6 mx-auto border-2 border-accent border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-dim">Loading deals...</p>
          </div>
        ) : error ? (
          <div className="bg-danger/5 rounded-2xl p-8">
            <p className="text-danger text-sm">{error}</p>
          </div>
        ) : deals.length === 0 ? (
          <div className="bg-surface rounded-2xl p-16 text-center shadow-elevation-1">
            <p className="text-dim mb-5 text-base">No deals found</p>
            <Link href="/deals/create" className="btn-outline text-sm">Create your first deal</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {deals.map((deal) => (
              <Link
                key={deal.deal_id}
                href={`/deals/${deal.deal_id}`}
                className="bg-surface rounded-2xl p-6 shadow-elevation-1 hover:shadow-elevation-2 hover:-translate-y-0.5 transition-all duration-200 group"
              >
                <div className="flex justify-between items-start mb-5">
                  <span className="text-xs text-muted font-medium">#{deal.deal_id}</span>
                  <StatusBadge status={deal.status} />
                </div>

                <div className="mb-5">
                  <div className="font-heading text-xl font-semibold text-bright">
                    {formatAmount(BigInt(deal.amount_base))} ETH
                  </div>
                  <div className="text-sm text-dim mt-1.5">
                    {getChainName(deal.chain_id_base)} &rarr; {getChainName(deal.chain_id_quote)}
                  </div>
                </div>

                <div className="space-y-2 text-sm pt-5 border-t border-edge/50">
                  <div className="flex justify-between">
                    <span className="text-muted">Maker</span>
                    <span className="font-mono text-xs text-dim">{formatAddress(deal.maker)}</span>
                  </div>
                  {deal.taker && (
                    <div className="flex justify-between">
                      <span className="text-muted">Taker</span>
                      <span className="font-mono text-xs text-dim">{formatAddress(deal.taker)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted">Rate</span>
                    <span className="text-dim">{deal.price_quote_per_base}:1</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
