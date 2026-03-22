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
      <head>
        <Script
          id="microsoft-clarity"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window, document, "clarity", "script", "vtqqbj1xxa");`,
          }}
        />
      </head>
      <body className="font-sans">
          <LayoutWrapper>{children}</LayoutWrapper>
        </body>
    </html>
  )
}
