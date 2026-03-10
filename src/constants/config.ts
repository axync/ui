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
    vaultContract: process.env.NEXT_PUBLIC_ETHEREUM_VAULT_CONTRACT || '0x4E059D94012d494fBcFfC89C2E6ee4Ea853cA92F',
    verifierContract: process.env.NEXT_PUBLIC_ETHEREUM_VERIFIER_CONTRACT || '0x6eaE425A7830349F7716b8AaF8ff5e76E5c6d6a2',
  },
  BASE_SEPOLIA: {
    id: 84532,
    name: 'Base Sepolia',
    vaultContract: process.env.NEXT_PUBLIC_BASE_VAULT_CONTRACT || '0x807d220AC80c59aC9F8C6C3d86211F04D80b9c53',
    verifierContract: process.env.NEXT_PUBLIC_BASE_VERIFIER_CONTRACT || '0x53743f261a8941Edb71973F1Ae98C69D7a6dBDda',
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

// AxyncVault ABI (deposit + withdrawal)
export const VAULT_CONTRACT_ABI = [
  'function deposit(uint256 assetId, uint256 amount) external',
  'function depositNative(uint256 assetId) external payable',
  'function withdraw((address user, uint256 assetId, uint256 amount, uint256 chainId) withdrawalData, bytes merkleProof, bytes32 nullifier, bytes zkProof, bytes32 withdrawalsRoot_) external',
  'function withdrawalsRoot() view returns (bytes32)',
] as const

// Helper function to get vault contract by chain ID
export function getVaultContract(chainId: number): string {
  const chain = AVAILABLE_CHAINS.find((c) => c.id === chainId)
  return chain?.vaultContract || ''
}

// Helper function to get chain name by chain ID
export function getChainName(chainId: number): string {
  const chain = AVAILABLE_CHAINS.find((c) => c.id === chainId)
  return chain?.name || `Chain ${chainId}`
}

// Chain IDs for network switching
export function getChainHex(chainId: number): string {
  return '0x' + chainId.toString(16)
}
