'use client'

import Link from 'next/link'
import Layout from '@/components/Layout'
import { api } from '@/services/api'
import { useEffect, useState } from 'react'

export default function Home() {
  const [health, setHealth] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check API health
    api
      .healthCheck()
      .then((data) => {
        setHealth(data)
      })
      .catch((err) => {
        console.error('API health check failed:', err)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  return (
    <Layout>
      <div className="px-4 py-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to ZKClear
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Institutional OTC Settlement Platform with Zero-Knowledge Guarantees
          </p>

          {/* API Status */}
          <div className="mb-8">
            {loading ? (
              <div className="inline-flex items-center px-4 py-2 bg-gray-100 rounded-md">
                <span className="text-gray-600">Checking API status...</span>
              </div>
            ) : health ? (
              <div
                className={`inline-flex items-center px-4 py-2 rounded-md ${
                  health.status === 'healthy'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                <span className="mr-2">
                  {health.status === 'healthy' ? '✓' : '⚠'}
                </span>
                <span>API Status: {health.status}</span>
              </div>
            ) : (
              <div className="inline-flex items-center px-4 py-2 bg-red-100 text-red-800 rounded-md">
                <span className="mr-2">✗</span>
                <span>API is not available</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-2">Deals</h2>
              <p className="text-gray-600 mb-4">
                Create and manage OTC settlement deals. Deposit is automatic when needed.
              </p>
              <Link
                href="/deals"
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                Go to Deals →
              </Link>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-2">Withdrawals</h2>
              <p className="text-gray-600 mb-4">
                Withdraw your assets back to L1 chains
              </p>
              <Link
                href="/withdrawals"
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                Go to Withdrawals →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
