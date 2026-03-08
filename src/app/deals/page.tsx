'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { api, Deal } from '@/services/api'
import { formatAddress, formatAmount } from '@/utils/transactions'

export default function Deals() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'my' | 'active' | 'completed'>(
    'all'
  )

  useEffect(() => {
    // For now, we'll show a placeholder
    // In the future, we'll add an endpoint to list all deals
    loadDeals()
  }, [filter])

  const loadDeals = async () => {
    setLoading(true)
    setError(null)
    try {
      const params: any = {}
      if (filter === 'active') {
        params.status = 'pending'
      } else if (filter === 'completed') {
        params.status = 'settled'
      }
      // TODO: Add address filter for 'my' deals when wallet is connected
      
      const response = await api.getDealsList(params)
      setDeals(response.deals)
    } catch (err: any) {
      setError(err.message || 'Failed to load deals')
      console.error('Error loading deals:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Deals</h1>
          <Link
            href="/deals/create"
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
          >
            Create Deal
          </Link>
        </div>

        {/* Filters */}
        <div className="mb-6 flex space-x-4">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-md ${
              filter === 'all'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('my')}
            className={`px-4 py-2 rounded-md ${
              filter === 'my'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            My Deals
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-4 py-2 rounded-md ${
              filter === 'active'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-4 py-2 rounded-md ${
              filter === 'completed'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Completed
          </button>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600">Loading deals...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 rounded-lg shadow p-6">
            <p className="text-red-600">Error: {error}</p>
          </div>
        ) : deals.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-center py-8">
              No deals found. Create your first deal to get started!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {deals.map((deal) => (
              <Link
                key={deal.deal_id}
                href={`/deals/${deal.deal_id}`}
                className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Deal #{deal.deal_id}</h3>
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      deal.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : deal.status === 'completed'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {deal.status}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">Maker: </span>
                    <span className="font-mono text-gray-900">{formatAddress(deal.maker)}</span>
                  </div>
                  {deal.taker && (
                    <div>
                      <span className="text-gray-600">Taker: </span>
                      <span className="font-mono text-gray-900">{formatAddress(deal.taker)}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-600">Amount: </span>
                    <span className="text-gray-900">{formatAmount(BigInt(deal.amount_base))}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Price: </span>
                    <span className="text-gray-900">{formatAmount(BigInt(deal.price_quote_per_base))}</span>
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
