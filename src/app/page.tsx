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
      <div className="py-12">
        {/* Hero */}
        <div className="text-center mb-16 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-[radial-gradient(ellipse,rgba(148,163,184,0.04)_0%,transparent_70%)] pointer-events-none" />

          <div className="relative">
            <p className="font-mono text-[10px] tracking-[4px] uppercase text-silver-lo mb-4">
              Cross-Chain Settlement
            </p>
            <h1 className="font-heading text-4xl sm:text-5xl font-bold text-bright mb-4 tracking-tight">
              Proof, not promises.
            </h1>
            <p className="text-dim max-w-lg mx-auto text-base">
              Move value across chains without bridges. Every settlement verified by zero-knowledge proofs.
            </p>
          </div>

          {/* Status */}
          <div className="mt-8 flex justify-center">
            {loading ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-elevated border border-edge">
                <div className="w-2 h-2 rounded-full bg-muted animate-pulse" />
                <span className="font-mono text-xs text-dim">Checking status...</span>
              </div>
            ) : health ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-elevated border border-edge">
                <div className={`w-2 h-2 rounded-full ${health.status === 'healthy' ? 'bg-success' : 'bg-warning'}`} />
                <span className="font-mono text-xs text-silver-lo">
                  {health.status === 'healthy' ? 'Network Online' : 'Degraded'}
                </span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-elevated border border-edge">
                <div className="w-2 h-2 rounded-full bg-danger" />
                <span className="font-mono text-xs text-danger">Offline</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl mx-auto">
          <Link href="/deals" className="group bg-surface border border-edge rounded-2xl p-6 hover:border-muted transition-all">
            <div className="flex items-start justify-between mb-4">
              <span className="font-mono text-[9px] tracking-[3px] uppercase text-silver-lo">Deals</span>
              <span className="text-dim group-hover:text-silver-lo transition-colors text-lg">&rarr;</span>
            </div>
            <h2 className="font-heading text-xl font-semibold text-bright mb-2">Trade</h2>
            <p className="text-sm text-dim leading-relaxed">
              Create and accept cross-chain settlement deals. Deposit is automatic when needed.
            </p>
          </Link>

          <Link href="/withdrawals" className="group bg-surface border border-edge rounded-2xl p-6 hover:border-muted transition-all">
            <div className="flex items-start justify-between mb-4">
              <span className="font-mono text-[9px] tracking-[3px] uppercase text-silver-lo">Withdraw</span>
              <span className="text-dim group-hover:text-silver-lo transition-colors text-lg">&rarr;</span>
            </div>
            <h2 className="font-heading text-xl font-semibold text-bright mb-2">Withdraw</h2>
            <p className="text-sm text-dim leading-relaxed">
              Withdraw settled assets back to their native chains with ZK proof verification.
            </p>
          </Link>
        </div>
      </div>
    </Layout>
  )
}
