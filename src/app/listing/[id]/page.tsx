import type { Metadata } from 'next'
import { ethers } from 'ethers'
import ListingClient from './ListingClient'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

const CHAIN_NAMES: Record<number, string> = {
  11155111: 'Sepolia',
  84532: 'Base',
}

async function fetchListing(id: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/nft-listing/${id}`, {
      next: { revalidate: 30 },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const listing = await fetchListing(id)

  if (!listing) {
    return {
      title: `Deal #${id} — Axync`,
      description: 'View this cross-chain deal on Axync.',
    }
  }

  const isToken = listing.asset_type === 'ERC20'
  const priceEth = ethers.formatEther(listing.price)
  const assetChain = CHAIN_NAMES[listing.nft_chain_id] || `Chain ${listing.nft_chain_id}`
  const paymentChain = CHAIN_NAMES[listing.payment_chain_id] || `Chain ${listing.payment_chain_id}`

  const assetLabel = isToken
    ? `${ethers.formatEther(listing.amount?.toString() || '0')} tokens`
    : `NFT #${listing.token_id}`

  const title = `${assetLabel} for ${priceEth} ETH — Axync`
  const description = `Cross-chain deal: ${assetLabel} on ${assetChain} for ${priceEth} ETH (paid on ${paymentChain}). ZK-powered settlement on Axync.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://app.axync.xyz/listing/${id}`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default function ListingPage() {
  return <ListingClient />
}
