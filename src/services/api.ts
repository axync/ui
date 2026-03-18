import axios from 'axios'

const API_BASE_URL =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000')
    : 'http://localhost:3000'

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.config?.url, error.response?.status, error.response?.data)
    return Promise.reject(error)
  }
)

// Types

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

export interface Listing {
  id: number
  seller: string
  nft_contract: string
  token_id: number
  payment_token: string
  price: string
  active: boolean
}

export interface EnrichedListing extends Listing {
  nft_name: string
  nft_symbol: string
  platform: string | null // "sablier", "hedgey", or null for generic
}

export interface NftMetadata {
  contract: string
  token_id: number
  name: string
  symbol: string
  token_uri: string
  image: string
}

export interface NftPosition {
  contract: string
  token_id: number
  name: string
  symbol: string
  token_uri: string
}

// API

export const api = {
  async healthCheck() {
    const response = await apiClient.get('/health')
    return response.data
  },

  async getVestingPositions(address: string): Promise<{ positions: VestingPosition[]; total: number }> {
    const response = await apiClient.get(`/api/v1/vesting/${address}`)
    return response.data
  },

  async getListings(): Promise<{ listings: EnrichedListing[]; total: number }> {
    const response = await apiClient.get('/api/v1/listings')
    return response.data
  },

  async getListingDetail(id: number): Promise<{ listing: Listing; nft: NftMetadata | null; vesting: VestingPosition | null }> {
    const response = await apiClient.get(`/api/v1/listing/${id}`)
    return response.data
  },

  async getNfts(address: string, contracts: string[]): Promise<{ address: string; nfts: NftPosition[]; total: number }> {
    const params = contracts.length > 0 ? `?contracts=${contracts.join(',')}` : ''
    const response = await apiClient.get(`/api/v1/nfts/${address}${params}`)
    return response.data
  },
}

export default api
