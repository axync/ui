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
    <svg width="20" height="25" viewBox="0 0 120 150" fill="none">
      <defs>
        <linearGradient id="nav-g" x1="10" y1="10" x2="120" y2="140" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E2E8F0" />
          <stop offset="45%" stopColor="#CBD5E1" />
          <stop offset="100%" stopColor="#94A3B8" />
        </linearGradient>
      </defs>
      <line x1="60" y1="10" x2="10" y2="140" stroke="url(#nav-g)" strokeWidth="4" strokeLinecap="round" />
      <line x1="60" y1="10" x2="110" y2="140" stroke="url(#nav-g)" strokeWidth="4" strokeLinecap="round" />
      <line x1="36.9" y1="70" x2="96.5" y2="105" stroke="url(#nav-g)" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="83.1" y1="70" x2="23.5" y2="105" stroke="url(#nav-g)" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  )
}

export default function Layout({ children }: LayoutProps) {
  const pathname = usePathname()

  const isActive = (path: string) => {
    if (path === '/deals') return pathname === '/deals' || pathname === '/deals/create' || pathname?.startsWith('/deals/')
    return pathname === path
  }

  const navLinks = [
    { href: '/deals', label: 'Deals' },
    { href: '/withdrawals', label: 'Withdraw' },
    { href: '/account', label: 'Account' },
  ]

  return (
    <div className="min-h-screen bg-base">
      <nav className="sticky top-0 z-50 bg-base/90 backdrop-blur-xl shadow-elevation-2">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-10">
              <Link href="/" className="flex items-center gap-2.5">
                <AxyncLogo />
                <span className="font-heading font-semibold text-bright text-lg tracking-tight">Axync</span>
              </Link>
              <div className="hidden sm:flex items-center gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`relative px-4 py-2 text-sm font-body font-medium transition-colors ${
                      isActive(link.href)
                        ? 'text-bright'
                        : 'text-muted hover:text-dim'
                    }`}
                  >
                    {link.label}
                    {isActive(link.href) && (
                      <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-accent rounded-full" />
                    )}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center">
              <WalletConnect />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto py-10 px-6">
        {children}
      </main>
    </div>
  )
}
