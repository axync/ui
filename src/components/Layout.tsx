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
    <svg width="24" height="30" viewBox="0 0 120 150" fill="none">
      <defs>
        <linearGradient id="nav-g" x1="10" y1="10" x2="120" y2="140" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#CCCCFF" />
          <stop offset="100%" stopColor="#7DD3FC" />
        </linearGradient>
      </defs>
      <line x1="60" y1="10" x2="10" y2="140" stroke="url(#nav-g)" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="60" y1="10" x2="110" y2="140" stroke="url(#nav-g)" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="36.9" y1="70" x2="96.5" y2="105" stroke="url(#nav-g)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="83.1" y1="70" x2="23.5" y2="105" stroke="url(#nav-g)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

export default function Layout({ children }: LayoutProps) {
  const pathname = usePathname()

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/'
    if (path === '/list') return pathname === '/list'
    if (path === '/listing') return pathname?.startsWith('/listing/')
    if (path === '/portfolio') return pathname === '/portfolio'
    return pathname === path
  }

  const navLinks = [
    { href: '/', label: 'Marketplace', icon: '◆' },
    { href: '/list', label: 'Create Deal', icon: '+' },
    { href: '/portfolio', label: 'Portfolio', icon: '◎' },
  ]

  return (
    <div className="min-h-screen bg-bg">
      {/* Glow effects */}
      <div className="glow-tl" />
      <div className="glow-br" />

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-brd bg-bg/80 backdrop-blur-xl">
        <div className="max-w-[1200px] mx-auto h-16 flex items-center justify-between px-6 md:px-8">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 group">
              <AxyncLogo />
              <span className="font-bold text-lg text-gradient">
                Axync
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all flex items-center gap-2 ${
                    isActive(link.href)
                      ? 'text-lav bg-lav/[0.08] shadow-sm'
                      : 'text-tx3 hover:text-tx hover:bg-bg3/60'
                  }`}
                >
                  <span className="text-[10px] opacity-60">{link.icon}</span>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Right: Network + Wallet */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg2 border border-brd text-[11px] text-tx2 font-mono">
              <span className="w-2 h-2 rounded-full bg-green animate-pulse flex-shrink-0" />
              Sepolia
            </div>
            <WalletConnect />
          </div>
        </div>
      </nav>

      {/* Mobile nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-brd bg-bg/90 backdrop-blur-xl">
        <div className="flex items-center justify-around h-14">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center gap-0.5 px-4 py-1.5 text-[10px] font-medium transition-all ${
                isActive(link.href) ? 'text-lav' : 'text-tx3'
              }`}
            >
              <span className="text-base">{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-[1200px] mx-auto pt-16 px-6 md:px-8 pb-24 md:pb-16 relative z-10">
        <div className="pt-6 md:pt-8">
          {children}
        </div>
      </main>
    </div>
  )
}
