'use client'

import Link from 'next/link'
import Layout from '@/components/Layout'
import { api } from '@/services/api'
import { useEffect, useState } from 'react'

export default function Home() {
  const [health, setHealth] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .healthCheck()
      .then((data) => setHealth(data))
      .catch((err) => console.error('API health check failed:', err))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Layout>
      <div className="py-16">
        {/* Hero */}
        <div className="text-center mb-20 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[radial-gradient(ellipse,rgba(96,165,250,0.04)_0%,transparent_70%)] pointer-events-none" />

          <div className="relative">
            <p className="text-sm font-medium tracking-wide text-accent/70 mb-5">
              Cross-Chain Settlement
            </p>
            <h1 className="font-heading text-5xl sm:text-6xl font-bold text-bright mb-5 tracking-tight leading-[1.1]">
              Proof, not promises.
            </h1>
            <p className="text-dim max-w-md mx-auto text-base leading-relaxed">
              Move value across chains without bridges. Every settlement verified by zero-knowledge proofs.
            </p>
          </div>

          {/* Status */}
          <div className="mt-10 flex justify-center">
            {loading ? (
              <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-surface shadow-elevation-1">
                <div className="w-2 h-2 rounded-full bg-muted animate-pulse" />
                <span className="text-xs text-dim font-medium">Checking status...</span>
              </div>
            ) : health ? (
              <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-surface shadow-elevation-1">
                <div className={`w-2 h-2 rounded-full ${health.status === 'healthy' ? 'bg-success' : 'bg-warning'}`} />
                <span className="text-xs font-medium text-dim">
                  {health.status === 'healthy' ? 'Network Online' : 'Degraded'}
                </span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-surface shadow-elevation-1">
                <div className="w-2 h-2 rounded-full bg-danger" />
                <span className="text-xs font-medium text-danger">Offline</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto">
          <Link href="/deals" className="group bg-surface rounded-2xl p-8 shadow-elevation-1 hover:shadow-elevation-2 hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex items-center justify-between mb-6">
              <span className="text-xs font-medium text-accent/60 uppercase tracking-wider">Deals</span>
              <span className="text-muted group-hover:text-accent transition-colors text-lg">&rarr;</span>
            </div>
            <h2 className="font-heading text-xl font-semibold text-bright mb-2.5">Trade</h2>
            <p className="text-sm text-dim leading-relaxed">
              Create and accept cross-chain settlement deals. Deposit is automatic when needed.
            </p>
          </Link>

          <Link href="/withdrawals" className="group bg-surface rounded-2xl p-8 shadow-elevation-1 hover:shadow-elevation-2 hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex items-center justify-between mb-6">
              <span className="text-xs font-medium text-accent/60 uppercase tracking-wider">Withdraw</span>
              <span className="text-muted group-hover:text-accent transition-colors text-lg">&rarr;</span>
            </div>
            <h2 className="font-heading text-xl font-semibold text-bright mb-2.5">Withdraw</h2>
            <p className="text-sm text-dim leading-relaxed">
              Withdraw settled assets back to their native chains with ZK proof verification.
            </p>
          </Link>
        </div>
      </div>
    </Layout>
  )
}
