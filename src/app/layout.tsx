import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Axync — Cross-Chain Settlement',
  description:
    'Move value across chains. No bridge required. Every settlement verified by zero-knowledge proofs.',
  keywords: [
    'cross-chain',
    'settlement',
    'OTC',
    'zero-knowledge',
    'ZK proofs',
    'DeFi',
    'blockchain',
    'Ethereum',
    'Base',
  ],
  openGraph: {
    title: 'Axync — Cross-Chain Settlement',
    description:
      'Move value across chains. No bridge required. Every settlement verified by zero-knowledge proofs.',
    url: 'https://app.axync.xyz',
    siteName: 'Axync',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Axync — Cross-Chain Settlement',
    description:
      'Move value across chains. No bridge required. Every settlement verified by zero-knowledge proofs.',
  },
  metadataBase: new URL('https://app.axync.xyz'),
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-body">{children}</body>
    </html>
  )
}
