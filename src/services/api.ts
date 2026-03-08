import axios from 'axios'

// For client-side requests, we need to use the full backend URL
// Next.js rewrites only work for server-side requests
const API_BASE_URL = 
  typeof window !== 'undefined' 
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000')
    : 'http://localhost:3000' // Server-side can use direct URL

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add response interceptor for debugging
apiClient.interceptors.response.use(
  (response) => {
    console.log('✅ API Response:', response.config.url, response.status)
    return response
  },
  (error) => {
    console.log('❌ API Error:', error.config?.url, error.response?.status, error.response?.data)
    return Promise.reject(error)
  }
)

// Types
export interface AccountState {
  account_id: string
  owner: string
  balances: Balance[]
  nonce: number
}

export interface Balance {
  asset_id: number
  amount: string
  chain_id: number
}

export interface Deal {
  deal_id: number
  maker: string
  taker: string | null
  asset_base: number
  asset_quote: number
  chain_id_base: number
  chain_id_quote: number
  amount_base: string
  amount_remaining?: string
  price_quote_per_base: string
  visibility: 'public' | 'private'
  status: 'pending' | 'active' | 'completed' | 'cancelled'
  created_at?: number
  expires_at?: number | null
  is_cross_chain?: boolean
}

export interface Block {
  id: number
  timestamp: number
  transactions: any[]
  state_root: string
  withdrawals_root: string
  block_proof: string
}

export interface QueueStatus {
  queue_length: number
  max_queue_size: number
}

export interface Chain {
  chain_id: number
  name: string
}

// API functions
export const api = {
  // Health check
  async healthCheck() {
    const response = await apiClient.get('/health')
    return response.data
  },

  // Account endpoints
  async getAccountState(address: string): Promise<AccountState> {
    console.log('📡 api.getAccountState called for:', address)
    try {
      const response = await apiClient.get(`/api/v1/account/${address}`)
      console.log('✅ api.getAccountState success:', response.data)
      // Backend returns AccountStateResponse, convert to AccountState
      const data = response.data
      return {
        account_id: data.account_id?.toString() || address,
        owner: data.address 
          ? `0x${Array.from(data.address).map((b: number) => b.toString(16).padStart(2, '0')).join('')}`
          : address,
        balances: (data.balances || []).map((b: any) => ({
          asset_id: b.asset_id,
          chain_id: b.chain_id,
          amount: b.amount?.toString() || '0',
        })),
        nonce: data.nonce || 0,
      }
    } catch (error: any) {
      console.log('❌ api.getAccountState error:', error)
      console.log('Error response:', error.response)
      console.log('Error status:', error.response?.status)
      throw error
    }
  },

  async getAccountBalance(address: string, assetId: number): Promise<Balance> {
    const response = await apiClient.get(
      `/api/v1/account/${address}/balance/${assetId}`
    )
    return response.data
  },

  // Deal endpoints
  async getDealsList(params?: {
    status?: string
    address?: string
    visibility?: string
  }): Promise<{ deals: Deal[]; total: number }> {
    const response = await apiClient.get('/api/v1/deals', { params })
    const data = response.data
    // Convert address arrays to hex strings for all deals
    return {
      ...data,
      deals: data.deals.map((deal: any) => ({
        ...deal,
        maker: Array.isArray(deal.maker)
          ? `0x${Array.from(deal.maker).map((b: number) => b.toString(16).padStart(2, '0')).join('')}`
          : deal.maker,
        taker: deal.taker && Array.isArray(deal.taker)
          ? `0x${Array.from(deal.taker).map((b: number) => b.toString(16).padStart(2, '0')).join('')}`
          : deal.taker,
      })),
    }
  },

  async getDealDetails(dealId: number): Promise<Deal> {
    const response = await apiClient.get(`/api/v1/deal/${dealId}`)
    const data = response.data
    // Convert address arrays to hex strings
    return {
      ...data,
      maker: Array.isArray(data.maker)
        ? `0x${Array.from(data.maker).map((b: number) => b.toString(16).padStart(2, '0')).join('')}`
        : data.maker,
      taker: data.taker && Array.isArray(data.taker)
        ? `0x${Array.from(data.taker).map((b: number) => b.toString(16).padStart(2, '0')).join('')}`
        : data.taker,
    }
  },

  // Block endpoints
  async getBlockInfo(blockId: number): Promise<Block> {
    const response = await apiClient.get(`/api/v1/block/${blockId}`)
    return response.data
  },

  // Queue status
  async getQueueStatus(): Promise<QueueStatus> {
    const response = await apiClient.get('/api/v1/queue/status')
    return response.data
  },

  // Supported chains
  async getSupportedChains(): Promise<Chain[]> {
    const response = await apiClient.get('/api/v1/chains')
    return response.data
  },

  // JSON-RPC
  async jsonRpc(method: string, params: any[] = []) {
    const response = await apiClient.post('/jsonrpc', {
      jsonrpc: '2.0',
      method,
      params,
      id: 1,
    })
    return response.data
  },

  // Submit transaction
  // For CreateDeal, all fields should be at top level, not in payload
  async submitTransaction(request: any) {
    const response = await apiClient.post('/api/v1/transactions', request)
    return response.data
  },
}

export default api

