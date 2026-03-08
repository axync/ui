/**
 * Application Configuration Constants
 * 
 * Centralized configuration for tokens, chains, and other app settings
 */

// Supported Assets
// Note: In contracts, asset ID 0 is reserved for native ETH (depositNative)
// But the contract requires assetId > 0, so we use 1 for ETH in the system
export const ASSETS = {
  ETH: {
    id: 1, // Changed from 0 to 1 because contract requires assetId > 0
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
} as const

// Supported Chains (Testnets)
export const CHAINS = {
  ETHEREUM_SEPOLIA: {
    id: 11155111,
    name: 'Ethereum Sepolia',
    depositContract: process.env.NEXT_PUBLIC_ETHEREUM_DEPOSIT_CONTRACT || '0x261ecf36739D5BD02D1895D54f066762881878da',
    withdrawalContract: process.env.NEXT_PUBLIC_ETHEREUM_WITHDRAWAL_CONTRACT || '0x8f7c28682710AC962c39516140Fae8567D555fA1',
  },
  BASE_SEPOLIA: {
    id: 84532,
    name: 'Base Sepolia',
    depositContract: process.env.NEXT_PUBLIC_BASE_DEPOSIT_CONTRACT || '0x4aa15cAc206B4CAB551Dd70395cA4cf80db6EcAC',
    withdrawalContract: process.env.NEXT_PUBLIC_BASE_WITHDRAWAL_CONTRACT || '0xc5964A6C8409aD8e7d0276bcDc5ea4E2Dd02df2e',
  },
} as const

// Available chains list (for UI dropdowns)
export const AVAILABLE_CHAINS = [
  CHAINS.ETHEREUM_SEPOLIA,
  CHAINS.BASE_SEPOLIA,
] as const

// Default values
export const DEFAULTS = {
  ASSET: ASSETS.ETH.id, // Only ETH is supported
  CHAIN_BASE: CHAINS.ETHEREUM_SEPOLIA.id,
  CHAIN_QUOTE: CHAINS.BASE_SEPOLIA.id,
  PRICE_RATE: '1', // 1:1 exchange rate by default
} as const

// Helper function to get deposit contract by chain ID
export function getDepositContract(chainId: number): string {
  const chain = AVAILABLE_CHAINS.find((c) => c.id === chainId)
  return chain?.depositContract || ''
}

// Helper function to get withdrawal contract by chain ID
export function getWithdrawalContract(chainId: number): string {
  const chain = AVAILABLE_CHAINS.find((c) => c.id === chainId)
  return chain?.withdrawalContract || ''
}

// Helper function to get chain name by chain ID
export function getChainName(chainId: number): string {
  const chain = AVAILABLE_CHAINS.find((c) => c.id === chainId)
  return chain?.name || `Chain ${chainId}`
}

