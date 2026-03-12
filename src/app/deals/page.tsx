'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { api, Deal } from '@/services/api'
import { formatAddress, formatAmount } from '@/utils/transactions'
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

export default function Deals() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'my' | 'pending' | 'settled'>('all')
  const [search, setSearch] = useState('')
  const [chainFilter, setChainFilter] = useState<'all' | 'eth' | 'base'>('all')

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

  const filteredDeals = deals.filter((d) => {
    if (search) {
      const s = search.toLowerCase()
      const matchId = `#${d.deal_id}`.includes(s) || `ax-${d.deal_id}`.includes(s)
      const matchAddr = d.maker?.toLowerCase().includes(s) || d.taker?.toLowerCase().includes(s)
      if (!matchId && !matchAddr) return false
    }
    if (chainFilter === 'eth' && d.chain_id_base !== 11155111 && d.chain_id_quote !== 11155111) return false
    if (chainFilter === 'base' && d.chain_id_base !== 84532 && d.chain_id_quote !== 84532) return false
    return true
  })

  const statusFilters = [
    { key: 'all', label: 'All' },
    { key: 'my', label: 'My Deals' },
    { key: 'pending', label: 'Active' },
    { key: 'settled', label: 'Settled' },
  ] as const

  const chainFilters = [
    { key: 'all', label: 'All Chains' },
    { key: 'eth', label: 'ETH', dot: '#627EEA' },
    { key: 'base', label: 'Base', dot: '#0052FF' },
  ] as const

  return (
    <Layout>
      <div>
        {/* Header */}
        <div className="flex justify-between items-center mb-5 fi">
          <div>
            <h2 className="text-xl font-bold mb-0.5">Deals</h2>
            <p className="text-xs text-tx3">
              {deals.filter((d) => d.status === 'Pending').length} active &bull; {deals.length} total
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/deals/create" className="btn btn-primary btn-sm">+ New Deal</Link>
          </div>
        </div>

        {/* Filters */}
        <div className="card fi1 !p-3 !px-4 mb-4">
          <div className="flex items-center gap-2.5 flex-wrap">
            <input
              type="text"
              placeholder="Search by ID, address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input flex-1 min-w-[180px] !py-1.5 !px-2.5 !text-[11px] !rounded-lg"
            />
            <div className="flex gap-1">
              {chainFilters.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setChainFilter(c.key as any)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-medium transition-all ${
                    chainFilter === c.key
                      ? 'border-lav/30 bg-lav/[0.06] text-lav'
                      : 'border-brd bg-bg text-tx2 hover:border-brd2 hover:text-tx'
                  }`}
                >
                  {'dot' in c && <span className="w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: c.dot }} />}
                  {c.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {statusFilters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key as any)}
                  className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-medium transition-all ${
                    filter === f.key
                      ? 'border-lav/30 bg-lav/[0.06] text-lav'
                      : 'border-brd bg-bg text-tx2 hover:border-brd2 hover:text-tx'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="card !p-16 text-center">
            <div className="w-5 h-5 mx-auto border-2 border-lav border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-tx3 text-sm">Loading deals...</p>
          </div>
        ) : error ? (
          <div className="card !border-red/20 !p-8">
            <p className="text-red text-sm">{error}</p>
          </div>
        ) : filteredDeals.length === 0 ? (
          <div className="card !p-16 text-center">
            <p className="text-tx3 mb-4">No deals found</p>
            <Link href="/deals/create" className="btn btn-outline btn-sm">Create your first deal</Link>
          </div>
        ) : (
          <div className="card fi2 !p-0 overflow-hidden">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Route</th>
                    <th>Amount</th>
                    <th>Maker</th>
                    <th>Taker</th>
                    <th>Rate</th>
                    <th>ZK</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeals.map((deal) => (
                    <tr key={deal.deal_id}>
                      <td className="font-mono text-[11px] text-tx2">
                        #AX-{String(deal.deal_id).padStart(4, '0')}
                      </td>
                      <td className="text-[11px] text-tx2">
                        <span
                          className="inline-block w-[7px] h-[7px] rounded-full mr-1"
                          style={{ background: deal.chain_id_base === 11155111 ? '#627EEA' : '#0052FF' }}
                        />
                        {getChainName(deal.chain_id_base)} &rarr; {getChainName(deal.chain_id_quote)}
                      </td>
                      <td>
                        <div className="font-medium">{formatAmount(BigInt(deal.amount_base), ASSETS.ETH.decimals)} ETH</div>
                      </td>
                      <td className="font-mono text-[11px] text-tx2">
                        {formatAddress(deal.maker)}
                      </td>
                      <td className="font-mono text-[11px] text-tx2">
                        {deal.taker ? formatAddress(deal.taker) : '—'}
                      </td>
                      <td className="font-mono text-[11px] text-tx2">
                        {deal.price_quote_per_base}:1
                      </td>
                      <td>
                        <span className="badge badge-lav" style={{ fontSize: '9px' }}>✓ SNARK</span>
                      </td>
                      <td>
                        <StatusBadge status={deal.status} />
                      </td>
                      <td>
                        <Link href={`/deals/${deal.deal_id}`} className="btn btn-sm btn-secondary !py-0.5 !px-2">
                          &#8599;
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-t border-brd">
              <div className="text-[11px] text-tx3">
                Showing {filteredDeals.length} of {deals.length} deals
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
