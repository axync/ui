// Contract addresses per chain
export const CONTRACTS = {
  // Ethereum Sepolia
  11155111: {
    vault: process.env.NEXT_PUBLIC_ETHEREUM_VAULT_CONTRACT || '',
    verifier: process.env.NEXT_PUBLIC_ETHEREUM_VERIFIER_CONTRACT || '',
    escrow: process.env.NEXT_PUBLIC_ETHEREUM_ESCROW_CONTRACT || '',
    rpc: process.env.NEXT_PUBLIC_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
    name: 'Ethereum Sepolia',
    shortName: 'Sepolia',
  },
  // Base Sepolia
  84532: {
    vault: process.env.NEXT_PUBLIC_BASE_VAULT_CONTRACT || '',
    verifier: process.env.NEXT_PUBLIC_BASE_VERIFIER_CONTRACT || '',
    escrow: process.env.NEXT_PUBLIC_BASE_ESCROW_CONTRACT || '',
    rpc: process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://base-sepolia-rpc.publicnode.com',
    name: 'Base Sepolia',
    shortName: 'Base',
  },
} as const

export type SupportedChainId = keyof typeof CONTRACTS

export const SUPPORTED_CHAIN_IDS = Object.keys(CONTRACTS).map(Number) as SupportedChainId[]

export function getContracts(chainId: number) {
  return CONTRACTS[chainId as SupportedChainId] || null
}

// EIP-712 domain for sequencer transactions
export const EIP712_DOMAIN = {
  name: 'Axync',
  version: '1',
}

export const BUYNFT_TYPES = {
  BuyNft: [
    { name: 'from', type: 'address' },
    { name: 'nonce', type: 'uint64' },
    { name: 'listingId', type: 'uint64' },
  ],
}
