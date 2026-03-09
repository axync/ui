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
    <span className={`font-mono text-[10px] px-2.5 py-1 rounded-md ${styles[status] || styles.Expired}`}>
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
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="font-heading text-2xl font-bold text-bright">Deals</h1>
            <p className="text-sm text-dim mt-1">Browse and manage cross-chain settlements</p>
          </div>
          <Link href="/deals/create" className="btn-silver">
            New Deal
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-1 mb-6 bg-surface border border-edge rounded-xl p-1 w-fit">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-1.5 rounded-lg text-xs font-body transition-colors ${
                filter === f.key
                  ? 'bg-elevated text-bright'
                  : 'text-dim hover:text-silver-lo'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-surface border border-edge rounded-2xl p-12 text-center">
            <p className="text-dim">Loading deals...</p>
          </div>
        ) : error ? (
          <div className="bg-danger/5 border border-danger/20 rounded-2xl p-6">
            <p className="text-danger text-sm">{error}</p>
          </div>
        ) : deals.length === 0 ? (
          <div className="bg-surface border border-edge rounded-2xl p-12 text-center">
            <p className="text-dim mb-4">No deals found</p>
            <Link href="/deals/create" className="btn-outline text-xs">Create your first deal</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {deals.map((deal) => (
              <Link
                key={deal.deal_id}
                href={`/deals/${deal.deal_id}`}
                className="bg-surface border border-edge rounded-2xl p-5 hover:border-muted transition-all group"
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="font-mono text-xs text-dim">#{deal.deal_id}</span>
                  <StatusBadge status={deal.status} />
                </div>

                <div className="mb-4">
                  <div className="font-heading text-lg font-semibold text-bright">
                    {formatAmount(BigInt(deal.amount_base))} ETH
                  </div>
                  <div className="font-mono text-xs text-silver-lo mt-1">
                    {getChainName(deal.chain_id_base)} &rarr; {getChainName(deal.chain_id_quote)}
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-dim">Maker</span>
                    <span className="font-mono text-silver-lo">{formatAddress(deal.maker)}</span>
                  </div>
                  {deal.taker && (
                    <div className="flex justify-between">
                      <span className="text-dim">Taker</span>
                      <span className="font-mono text-silver-lo">{formatAddress(deal.taker)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-dim">Rate</span>
                    <span className="font-mono text-silver-lo">{deal.price_quote_per_base}:1</span>
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
