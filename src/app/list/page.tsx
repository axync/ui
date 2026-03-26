import type { Metadata } from 'next'
import CreateDealClient from './CreateDealClient'

export const metadata: Metadata = {
  title: 'Create Deal — Axync',
  description:
    'List your ERC-20 tokens or NFTs for cross-chain sale. Set your price, choose payment chain, and create a deal with ZK-powered settlement.',
}

export default function CreateDealPage() {
  return <CreateDealClient />
}
