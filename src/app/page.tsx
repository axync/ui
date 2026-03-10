'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, useInView, useScroll, useTransform } from 'framer-motion'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { api } from '@/services/api'

const Scene3D = dynamic(() => import('@/components/landing/Scene3D'), { ssr: false })

/* ─── Animation helpers ───────────────────────────────── */

const ease: [number, number, number, number] = [0.21, 0.47, 0.32, 0.98]

function FadeSection({
  children,
  className,
  id,
}: {
  children: React.ReactNode
  className?: string
  id?: string
}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.section
      id={id}
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.8, ease }}
      className={className}
    >
      {children}
    </motion.section>
  )
}

function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 24 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function StaggerGrid({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      variants={{ visible: { transition: { staggerChildren: 0.12 } } }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ─── Inline SVG Icons ────────────────────────────────── */

const icons = {
  create: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M12 9v6M9 12h6" />
    </svg>
  ),
  settle: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M5 12h14" />
      <path d="M15 8l4 4-4 4" />
      <path d="M9 8l-4 4 4 4" />
    </svg>
  ),
  withdraw: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M12 4v12M8 12l4 4 4-4" />
      <path d="M5 20h14" />
    </svg>
  ),
  shield: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.5l7.5 3.5v5.5c0 5-3.2 9.3-7.5 11-4.3-1.7-7.5-6-7.5-11V6L12 2.5z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  direct: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="5" cy="12" r="2.5" />
      <circle cx="19" cy="12" r="2.5" />
      <path d="M7.5 12h9" />
      <path d="M14 9l3 3-3 3" />
    </svg>
  ),
  lock: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="5" y="11" width="14" height="10" rx="2.5" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </svg>
  ),
  zap: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L4.5 13.5H12L11 22l8.5-11.5H12L13 2z" />
    </svg>
  ),
}

/* ─── Logo SVG ────────────────────────────────────────── */

function Logo({ size = 22 }: { size?: number }) {
  const h = size * 1.25
  return (
    <svg width={size} height={h} viewBox="0 0 120 150" fill="none">
      <defs>
        <linearGradient id="lg" x1="10" y1="10" x2="120" y2="140" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F1F5F9" />
          <stop offset="45%" stopColor="#CBD5E1" />
          <stop offset="100%" stopColor="#60A5FA" />
        </linearGradient>
      </defs>
      <line x1="20" y1="10" x2="100" y2="140" stroke="url(#lg)" strokeWidth="10" strokeLinecap="round" />
      <line x1="100" y1="10" x2="20" y2="140" stroke="url(#lg)" strokeWidth="10" strokeLinecap="round" />
      <line x1="10" y1="50" x2="110" y2="50" stroke="url(#lg)" strokeWidth="8" strokeLinecap="round" />
      <line x1="10" y1="100" x2="110" y2="100" stroke="url(#lg)" strokeWidth="8" strokeLinecap="round" />
    </svg>
  )
}

/* ─── Main Landing Page ───────────────────────────────── */

export default function Landing() {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const { scrollY } = useScroll()
  const navBg = useTransform(scrollY, [0, 80], ['rgba(8,8,12,0)', 'rgba(8,8,12,0.85)'])
  const navBorder = useTransform(scrollY, [0, 80], ['rgba(42,42,56,0)', 'rgba(42,42,56,0.5)'])

  useEffect(() => {
    api.healthCheck().then(() => setStatus('online')).catch(() => setStatus('offline'))
  }, [])

  const stats = [
    { value: '2', label: 'Chains Live' },
    { value: '<30s', label: 'Settlement' },
    { value: '0', label: 'Bridges' },
    { value: 'ZK', label: 'Verified' },
  ]

  const steps = [
    {
      num: '01',
      title: 'Create a Deal',
      desc: 'Post a cross-chain deal with your desired amount, rate, and destination chain. Funds are secured in an on-chain vault.',
      icon: icons.create,
      accent: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      num: '02',
      title: 'Accept & Settle',
      desc: 'A counterparty accepts and deposits matching funds on the other chain. The sequencer settles the deal instantly.',
      icon: icons.settle,
      accent: 'text-violet-400',
      bg: 'bg-violet-500/10',
    },
    {
      num: '03',
      title: 'Withdraw',
      desc: 'Both parties withdraw settled funds on their destination chains, verified by zero-knowledge proofs on-chain.',
      icon: icons.withdraw,
      accent: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
  ]

  const features = [
    {
      title: 'Zero-Knowledge Proofs',
      desc: 'Every settlement is cryptographically verified. State transitions are proven with ZK proofs submitted on-chain.',
      icon: icons.shield,
      accent: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      title: 'No Bridges Needed',
      desc: 'Direct chain-to-chain settlement without bridge contracts. No wrapped tokens, no bridge risk, no complexity.',
      icon: icons.direct,
      accent: 'text-violet-400',
      bg: 'bg-violet-500/10',
    },
    {
      title: 'Non-Custodial',
      desc: 'Funds are held in auditable on-chain vault contracts. You maintain full control with no trusted intermediaries.',
      icon: icons.lock,
      accent: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      title: 'Instant Settlement',
      desc: 'Deals settle in seconds once accepted. Proof generation and on-chain verification happen automatically.',
      icon: icons.zap,
      accent: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
  ]

  const chains = [
    {
      name: 'Ethereum',
      sub: 'Sepolia Testnet',
      color: 'from-blue-500/15 to-blue-600/5',
      border: 'border-blue-500/15 hover:border-blue-500/30',
      dot: 'bg-blue-400',
      icon: (
        <svg className="w-9 h-9" viewBox="0 0 32 32" fill="none">
          <path d="M16 3l9 13.5-9 5.5-9-5.5L16 3z" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.08" />
          <path d="M16 22l9-5.5L16 29 7 16.5 16 22z" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.12" />
        </svg>
      ),
    },
    {
      name: 'Base',
      sub: 'Sepolia Testnet',
      color: 'from-sky-500/15 to-indigo-600/5',
      border: 'border-sky-500/15 hover:border-sky-500/30',
      dot: 'bg-sky-400',
      icon: (
        <svg className="w-9 h-9" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.08" />
          <path d="M16 8a8 8 0 100 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
  ]

  return (
    <div className="bg-base text-bright min-h-screen overflow-x-hidden">
      {/* ─── Navigation ─── */}
      <motion.nav
        style={{ backgroundColor: navBg, borderColor: navBorder }}
        className="fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-xl"
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <Logo />
            <span className="font-heading font-bold text-lg text-bright group-hover:text-silver-mid transition-colors">
              Axync
            </span>
          </Link>

          <div className="flex items-center gap-5">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-edge/50 bg-surface/30">
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  status === 'online' ? 'bg-success' : status === 'offline' ? 'bg-danger' : 'bg-warning animate-pulse'
                }`}
              />
              <span className="text-[11px] font-mono text-dim">
                {status === 'online' ? 'Testnet Live' : status === 'offline' ? 'Offline' : '...'}
              </span>
            </div>

            <Link href="/deals" className="btn-silver text-xs px-5 py-2.5">
              Launch App
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* ─── Hero ─── */}
      <section className="relative min-h-screen flex items-center justify-center pt-16">
        {/* BG: gradient orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="orb w-[700px] h-[700px] bg-blue-600/[0.07] top-[10%] -left-[15%]"
            style={{ animationDelay: '0s' }}
          />
          <div
            className="orb w-[500px] h-[500px] bg-violet-600/[0.06] bottom-[15%] -right-[10%]"
            style={{ animationDelay: '-8s' }}
          />
          <div
            className="orb w-[400px] h-[400px] bg-cyan-500/[0.04] top-[50%] left-[40%]"
            style={{ animationDelay: '-16s' }}
          />
        </div>

        {/* BG: 3D scene */}
        <div className="absolute inset-0 pointer-events-none opacity-70">
          <Scene3D />
        </div>

        {/* BG: grid */}
        <div className="absolute inset-0 grid-pattern pointer-events-none" />

        {/* Vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-base/40 via-transparent to-base pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease }}
          >
            <span className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-edge/60 bg-surface/40 backdrop-blur-sm text-[11px] font-mono text-dim mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-info animate-pulse" />
              Built on Base &middot; Sepolia Testnet
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.45, ease }}
            className="text-[3.2rem] sm:text-6xl md:text-7xl lg:text-8xl font-heading font-bold tracking-tight leading-[1.05] mb-7"
          >
            <span className="text-gradient-hero">Proof, not</span>
            <br />
            <span className="text-gradient-hero">promises.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.65, ease }}
            className="text-base sm:text-lg md:text-xl text-dim max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Cross-chain OTC settlement verified by zero-knowledge proofs.
            <br className="hidden sm:block" />
            No bridges. No intermediaries. Just math.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.85, ease }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/deals" className="btn-silver text-sm sm:text-base px-8 py-3 w-full sm:w-auto text-center">
              Launch App
            </Link>
            <a href="#how-it-works" className="btn-outline text-sm sm:text-base px-8 py-3 w-full sm:w-auto text-center">
              How It Works
            </a>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
            className="w-5 h-8 rounded-full border border-edge/60 flex items-start justify-center pt-1.5"
          >
            <div className="w-1 h-1.5 rounded-full bg-dim/60" />
          </motion.div>
        </motion.div>
      </section>

      {/* ─── Stats Bar ─── */}
      <FadeSection className="py-20 border-y border-edge/50">
        <div className="max-w-5xl mx-auto px-6">
          <StaggerGrid className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            {stats.map((s, i) => (
              <StaggerItem key={i} className="text-center">
                <div className="text-3xl sm:text-4xl font-heading font-bold text-bright mb-1.5">
                  {s.value}
                </div>
                <div className="text-xs font-mono tracking-wide uppercase text-dim">{s.label}</div>
              </StaggerItem>
            ))}
          </StaggerGrid>
        </div>
      </FadeSection>

      {/* ─── How It Works ─── */}
      <FadeSection id="how-it-works" className="py-24 md:py-32 landing-section">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="font-mono text-[10px] tracking-[3px] uppercase text-dim">
              How It Works
            </span>
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-bright mt-3">
              Three steps to settle
            </h2>
          </div>

          <StaggerGrid className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((step, i) => (
              <StaggerItem
                key={i}
                className="glass rounded-2xl p-7 relative group card-hover-glow"
              >
                <span className="absolute top-6 right-6 font-mono text-[11px] text-dim/40 font-medium">
                  {step.num}
                </span>
                <div
                  className={`w-11 h-11 rounded-xl ${step.bg} flex items-center justify-center mb-5 ${step.accent} transition-colors`}
                >
                  {step.icon}
                </div>
                <h3 className="font-heading font-semibold text-[17px] text-bright mb-2.5">
                  {step.title}
                </h3>
                <p className="text-dim text-sm leading-relaxed">{step.desc}</p>

                {i < 2 && (
                  <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                    <svg width="6" height="10" viewBox="0 0 6 10" className="text-dim/30">
                      <path d="M1 1l4 4-4 4" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                    </svg>
                  </div>
                )}
              </StaggerItem>
            ))}
          </StaggerGrid>
        </div>
      </FadeSection>

      {/* Divider */}
      <div className="section-glow mx-auto max-w-xl" />

      {/* ─── Features ─── */}
      <FadeSection className="py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="font-mono text-[10px] tracking-[3px] uppercase text-dim">
              Why Axync
            </span>
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-bright mt-3">
              Built for security
            </h2>
          </div>

          <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {features.map((f, i) => (
              <StaggerItem
                key={i}
                className="glass rounded-2xl p-7 group card-hover-glow flex gap-5"
              >
                <div
                  className={`w-11 h-11 rounded-xl ${f.bg} flex items-center justify-center shrink-0 ${f.accent} transition-colors`}
                >
                  {f.icon}
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-[17px] text-bright mb-2">
                    {f.title}
                  </h3>
                  <p className="text-dim text-sm leading-relaxed">{f.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGrid>
        </div>
      </FadeSection>

      {/* Divider */}
      <div className="section-glow mx-auto max-w-xl" />

      {/* ─── Supported Networks ─── */}
      <FadeSection className="py-24 md:py-32 landing-section">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="font-mono text-[10px] tracking-[3px] uppercase text-dim">
              Networks
            </span>
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-bright mt-3">
              Supported chains
            </h2>
          </div>

          <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
            {chains.map((c, i) => (
              <StaggerItem
                key={i}
                className={`relative overflow-hidden rounded-2xl p-7 bg-gradient-to-br ${c.color} border ${c.border} transition-all duration-300`}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-dim">{c.icon}</div>
                  <div>
                    <h3 className="font-heading font-semibold text-lg text-bright">{c.name}</h3>
                    <p className="text-dim text-xs font-mono">{c.sub}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                  <span className="text-xs font-mono text-dim">Active</span>
                </div>
              </StaggerItem>
            ))}
          </StaggerGrid>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="text-center text-dim text-sm font-mono"
          >
            More networks coming soon
          </motion.p>
        </div>
      </FadeSection>

      {/* ─── CTA ─── */}
      <FadeSection className="py-28 md:py-36 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="orb w-[500px] h-[500px] bg-blue-600/[0.05] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>

        <div className="relative z-10 text-center px-6 max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-heading font-bold text-bright mb-5">
            Ready to settle
            <br />
            <span className="text-gradient-hero">cross-chain?</span>
          </h2>
          <p className="text-dim text-base mb-10">
            Start your first deal in seconds. No signup required.
          </p>
          <Link
            href="/deals"
            className="btn-silver text-base px-10 py-3.5 inline-block"
          >
            Launch App
          </Link>
        </div>
      </FadeSection>

      {/* ─── Footer ─── */}
      <footer className="border-t border-edge/40 py-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <Logo size={16} />
            <span className="font-heading font-semibold text-sm text-dim">Axync</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/deals" className="text-xs text-dim hover:text-bright transition-colors font-mono">
              App
            </Link>
            <Link href="/withdrawals" className="text-xs text-dim hover:text-bright transition-colors font-mono">
              Withdraw
            </Link>
            <Link href="/account" className="text-xs text-dim hover:text-bright transition-colors font-mono">
              Account
            </Link>
          </div>
          <p className="text-[11px] text-muted font-mono">
            Cross-chain settlement protocol
          </p>
        </div>
      </footer>
    </div>
  )
}
