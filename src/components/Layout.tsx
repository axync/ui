'use client'

import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import WalletConnect from './wallet/WalletConnect'

interface LayoutProps {
  children: ReactNode
}

function AxyncLogo() {
  return (
    <svg width="22" height="28" viewBox="0 0 120 150" fill="none">
      <defs>
        <linearGradient id="nav-g" x1="10" y1="10" x2="120" y2="140" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E2E8F0" />
          <stop offset="45%" stopColor="#CBD5E1" />
          <stop offset="100%" stopColor="#94A3B8" />
        </linearGradient>
      </defs>
      <line x1="60" y1="10" x2="10" y2="140" stroke="url(#nav-g)" strokeWidth="3" strokeLinecap="round" />
      <line x1="60" y1="10" x2="110" y2="140" stroke="url(#nav-g)" strokeWidth="3" strokeLinecap="round" />
      <line x1="36.9" y1="70" x2="96.5" y2="105" stroke="url(#nav-g)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="83.1" y1="70" x2="23.5" y2="105" stroke="url(#nav-g)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

export default function Layout({ children }: LayoutProps) {
  const pathname = usePathname()

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/'
    if (path === '/deals') return pathname === '/deals' || pathname === '/deals/create' || pathname?.startsWith('/deals/')
    return pathname === path
  }

  const navLinks = [
    { href: '/', label: 'Dashboard' },
    { href: '/deals/create', label: 'New Deal' },
    { href: '/deals', label: 'Deals' },
    { href: '/withdrawals', label: 'Withdrawals' },
    { href: '/account', label: 'Account' },
  ]

  return (
    <div className="min-h-screen bg-bg">
      {/* Glow effects */}
      <div className="glow-tl" />
      <div className="glow-br" />

      {/* Topbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-8 border-b border-brd bg-bg/92 backdrop-blur-2xl">
        <div className="flex items-center gap-7">
          <Link href="/" className="flex items-center gap-2.5">
            <AxyncLogo />
            <span className="font-bold text-[17px] bg-gradient-to-br from-gray-200 to-gray-100 bg-clip-text text-transparent">
              Axync
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-0.5">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                  isActive(link.href)
                    ? 'text-lav bg-lav/[0.06]'
                    : 'text-tx3 hover:text-tx hover:bg-bg3'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-bg3 border border-brd text-[11px] text-tx2 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-green flex-shrink-0" />
            Sepolia
          </div>
          <WalletConnect />
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-[1200px] mx-auto pt-14 px-8 pb-16 relative z-10">
        <div className="pt-8">
          {children}
        </div>
      </main>
    </div>
  )
}
