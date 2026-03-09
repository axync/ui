import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Axync - Cross-Chain Settlement',
  description: 'Move value across chains. No bridge required. Every settlement verified by zero-knowledge proofs.',
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
