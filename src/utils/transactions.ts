import { ethers } from 'ethers'

// ── EIP-712 Domain & Types ─────────────────────────────────────────────────
// Domain: no chainId — cross-chain sequencer
const EIP712_DOMAIN = {
  name: 'Axync',
  version: '1',
}

const EIP712_TYPES: Record<string, Record<string, Array<{ name: string; type: string }>>> = {
  Deposit: {
    Deposit: [
      { name: 'from', type: 'address' },
      { name: 'nonce', type: 'uint64' },
      { name: 'txHash', type: 'bytes32' },
      { name: 'account', type: 'address' },
      { name: 'assetId', type: 'uint16' },
      { name: 'amount', type: 'uint128' },
      { name: 'chainId', type: 'uint64' },
    ],
  },
  Withdraw: {
    Withdraw: [
      { name: 'from', type: 'address' },
      { name: 'nonce', type: 'uint64' },
      { name: 'assetId', type: 'uint16' },
      { name: 'amount', type: 'uint128' },
      { name: 'to', type: 'address' },
      { name: 'chainId', type: 'uint64' },
    ],
  },
  CreateDeal: {
    CreateDeal: [
      { name: 'from', type: 'address' },
      { name: 'nonce', type: 'uint64' },
      { name: 'dealId', type: 'uint64' },
      { name: 'visibility', type: 'string' },
      { name: 'taker', type: 'address' },
      { name: 'assetBase', type: 'uint16' },
      { name: 'assetQuote', type: 'uint16' },
      { name: 'chainIdBase', type: 'uint64' },
      { name: 'chainIdQuote', type: 'uint64' },
      { name: 'amountBase', type: 'uint128' },
      { name: 'priceQuotePerBase', type: 'uint128' },
    ],
  },
  AcceptDeal: {
    AcceptDeal: [
      { name: 'from', type: 'address' },
      { name: 'nonce', type: 'uint64' },
      { name: 'dealId', type: 'uint64' },
    ],
  },
  CancelDeal: {
    CancelDeal: [
      { name: 'from', type: 'address' },
      { name: 'nonce', type: 'uint64' },
      { name: 'dealId', type: 'uint64' },
    ],
  },
}

/**
 * Build the EIP-712 value object for a given transaction kind + payload
 */
function buildEIP712Value(from: string, nonce: number, kind: string, payload: any): Record<string, any> {
  const base = { from, nonce }

  switch (kind) {
    case 'Deposit':
      return {
        ...base,
        txHash: payload.txHash,
        account: payload.account,
        assetId: payload.assetId,
        amount: BigInt(payload.amount),
        chainId: payload.chainId,
      }
    case 'Withdraw':
      return {
        ...base,
        assetId: payload.assetId,
        amount: BigInt(payload.amount),
        to: payload.to,
        chainId: payload.chainId,
      }
    case 'CreateDeal':
      return {
        ...base,
        dealId: payload.dealId,
        visibility: payload.visibility, // "Public" or "Direct"
        taker: payload.taker || ethers.ZeroAddress,
        assetBase: payload.assetBase,
        assetQuote: payload.assetQuote,
        chainIdBase: payload.chainIdBase,
        chainIdQuote: payload.chainIdQuote,
        amountBase: BigInt(payload.amountBase),
        priceQuotePerBase: BigInt(payload.priceQuotePerBase),
      }
    case 'AcceptDeal':
      return {
        ...base,
        dealId: payload.dealId,
      }
    case 'CancelDeal':
      return {
        ...base,
        dealId: payload.dealId,
      }
    default:
      throw new Error(`Unknown transaction kind: ${kind}`)
  }
}

/**
 * Sign transaction using EIP-712 typed data (shows structured, readable data in MetaMask)
 */
export async function signTransactionCorrect(
  signer: ethers.Signer,
  from: string,
  nonce: number,
  kind: string,
  payload: any
): Promise<string> {
  const types = EIP712_TYPES[kind]
  if (!types) {
    throw new Error(`No EIP-712 types defined for kind: ${kind}`)
  }

  const value = buildEIP712Value(from, nonce, kind, payload)
  const signature = await (signer as ethers.JsonRpcSigner).signTypedData(EIP712_DOMAIN, types, value)
  return signature
}

/**
 * Format address for display
 */
export function formatAddress(address: string): string {
  if (!address) return ''
  if (address.length < 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

/**
 * Format amount with decimals
 */
export function formatAmount(amount: bigint, decimals: number = 18): string {
  return ethers.formatUnits(amount, decimals)
}

/**
 * Parse amount from string
 * Handles invalid input gracefully by returning 0 instead of throwing
 */
export function parseAmount(amount: string, decimals: number = 18): bigint {
  if (!amount || amount.trim() === '') {
    return BigInt(0)
  }

  // Remove any non-numeric characters except decimal point and minus sign
  // Replace comma with dot for European number format
  let cleaned = amount.trim()
    .replace(',', '.') // Replace comma with dot
    .replace(/[^\d.-]/g, '') // Remove all non-numeric characters except . and -

  // If empty after cleaning, return 0
  if (!cleaned || cleaned === '' || cleaned === '-' || cleaned === '.') {
    return BigInt(0)
  }

  // Validate that it's a valid number
  if (!/^-?\d*\.?\d+$/.test(cleaned)) {
    return BigInt(0)
  }

  try {
    return ethers.parseUnits(cleaned, decimals)
  } catch (error) {
    console.warn('Failed to parse amount:', amount, error)
    return BigInt(0)
  }
}

