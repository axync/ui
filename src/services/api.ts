const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json()
}

// ═══════════════════════════════════════
// Types
// ═══════════════════════════════════════

export interface NftListing {
  id: number
  on_chain_listing_id: number
  seller: string
  buyer: string | null
  nft_contract: string
  token_id: number
  amount: number
  asset_type: 'ERC721' | 'ERC20'
  nft_chain_id: number
  payment_chain_id: number
  price: string
  status: 'Active' | 'Sold' | 'Cancelled'
  created_at: number
}

export interface AccountState {
  address: string
  nonce: number
  balances: { asset_id: number; amount: number; chain_id: number }[]
}

export interface ReleaseProof {
  listing_id: number
  on_chain_listing_id: number
  buyer: string
  nft_contract: string
  token_id: number
  nft_chain_id: number
  leaf: string
  merkle_proof: string
  nullifier: string
}

export interface VestingPosition {
  platform: string
  contract: string
  token_id: number
  token: string
  total_amount: string
  withdrawn_amount: string
  withdrawable_amount: string
  start_time: number
  end_time: number
  is_transferable: boolean
  is_cancelable: boolean
  status: string
}

export interface NftPosition {
  contract: string
  token_id: number
  name: string
  symbol: string
  token_uri: string
}

export interface ChainInfo {
  chain_id: number
  name: string
}

// ═══════════════════════════════════════
// API
// ═══════════════════════════════════════

export const api = {
  // Health
  async healthCheck() {
    return fetchAPI<{ status: string }>('/health')
  },

  // Sequencer listings (cross-chain, processed by sequencer)
  async getNftListings(): Promise<{ listings: NftListing[]; total: number }> {
    return fetchAPI('/api/v1/nft-listings')
  },

  async getNftListing(id: number): Promise<NftListing> {
    return fetchAPI(`/api/v1/nft-listing/${id}`)
  },

  // On-chain escrow listings (raw from contract events)
  async getEscrowListings(): Promise<{ listings: NftListing[]; total: number }> {
    return fetchAPI('/api/v1/listings')
  },

  // Release proof for claiming
  async getReleaseProof(listingId: number): Promise<ReleaseProof> {
    return fetchAPI(`/api/v1/nft-release-proof/${listingId}`)
  },

  // Account state (balances + nonce in sequencer)
  async getAccountState(address: string): Promise<AccountState> {
    return fetchAPI(`/api/v1/account/${address}`)
  },

  // Submit transaction (BuyNft)
  async submitTransaction(tx: {
    kind: 'BuyNft'
    from: string
    listing_id: number
    nonce: number
    signature: string
  }): Promise<{ tx_hash: string; status: string }> {
    return fetchAPI('/api/v1/transactions', {
      method: 'POST',
      body: JSON.stringify(tx),
    })
  },

  // Vesting positions
  async getVestingPositions(address: string): Promise<{ positions: VestingPosition[]; total: number }> {
    return fetchAPI(`/api/v1/vesting/${address}`)
  },

  // Generic NFTs
  async getNfts(address: string, contracts?: string[]): Promise<{ address: string; nfts: NftPosition[]; total: number }> {
    const params = contracts?.length ? `?contracts=${contracts.join(',')}` : ''
    return fetchAPI(`/api/v1/nfts/${address}${params}`)
  },

  // Supported chains
  async getChains(): Promise<{ chains: ChainInfo[] }> {
    return fetchAPI('/api/v1/chains')
  },

  // Current block
  async getCurrentBlock(): Promise<{ current_block_id: number }> {
    return fetchAPI('/api/v1/current_block')
  },
}

export default api
