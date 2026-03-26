import type { Metadata } from 'next'
import PortfolioClient from './PortfolioClient'

export const metadata: Metadata = {
  title: 'Portfolio — Axync',
  description:
    'Track your active deals, completed trades, and sequencer balances on Axync cross-chain marketplace.',
}

export default function PortfolioPage() {
  return <PortfolioClient />
}
