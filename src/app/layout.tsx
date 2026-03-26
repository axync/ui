import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import LayoutWrapper from '@/components/Layout'

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
  alternates: {
    canonical: 'https://app.axync.xyz',
  },
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
    site: '@axync_xyz',
    creator: '@axync_xyz',
  },
  metadataBase: new URL('https://app.axync.xyz'),
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Axync',
  url: 'https://app.axync.xyz',
  logo: 'https://app.axync.xyz/icon.svg',
  description:
    'Cross-chain marketplace for tokens and vesting positions. ZK-powered settlement.',
  sameAs: ['https://x.com/axync_xyz'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <Script
          id="microsoft-clarity"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window, document, "clarity", "script", "vtqqbj1xxa");`,
          }}
        />
      </head>
      <body className="font-sans">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
          <LayoutWrapper>{children}</LayoutWrapper>
        </body>
    </html>
  )
}
