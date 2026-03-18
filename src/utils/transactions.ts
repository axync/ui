import { ethers } from 'ethers'

export function formatAddress(address: string): string {
  if (!address) return ''
  if (address.length < 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function formatAmount(amount: bigint, decimals: number = 18): string {
  return ethers.formatUnits(amount, decimals)
}
