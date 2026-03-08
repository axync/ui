import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ZKClear - OTC Settlement Platform',
  description: 'Institutional OTC Settlement Platform with Zero-Knowledge Guarantees',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

