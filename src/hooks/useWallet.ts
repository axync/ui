'use client'

import { useState, useEffect, useCallback } from 'react'
import { api, AccountState } from '@/services/api'
import { getChainHex, getChainName } from '@/constants/config'

/**
 * Safe wrapper for window.ethereum calls.
 * Handles incompatible wallet extensions (Brave, Phantom, etc.)
 * that throw "this[#S].addListener is not a function"
 */
function getProvider(): typeof window.ethereum | null {
  if (typeof window === 'undefined') return null
  if (!window.ethereum) return null
  return window.ethereum
}

/**
 * Safe ethereum request — wraps in try-catch for broken wallet proxies
 */
async function safeRequest(method: string, params?: any[]): Promise<any> {
  const provider = getProvider()
  if (!provider) return null
  try {
    return await provider.request({ method, params })
  } catch {
    return null
  }
}

export interface UseWalletResult {
  /** Connected wallet address, or null */
  address: string | null
  /** Account state from the sequencer API */
  accountState: AccountState | null
  /** Whether account state is loading */
  loading: boolean
  /** Whether a wallet extension is installed */
  walletInstalled: boolean
  /** Reload account state from API */
  refreshAccountState: () => Promise<void>
  /** Switch wallet to target chain (auto-add if missing) */
  switchToChain: (chainId: number) => Promise<boolean>
}

const CHAIN_INFO: Record<number, any> = {
  11155111: {
    chainName: 'Ethereum Sepolia',
    rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com'],
    nativeCurrency: { name: 'SepoliaETH', symbol: 'ETH', decimals: 18 },
    blockExplorerUrls: ['https://sepolia.etherscan.io'],
  },
  84532: {
    chainName: 'Base Sepolia',
    rpcUrls: ['https://sepolia.base.org'],
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    blockExplorerUrls: ['https://sepolia.basescan.org'],
  },
}

export function useWallet(): UseWalletResult {
  const [address, setAddress] = useState<string | null>(null)
  const [accountState, setAccountState] = useState<AccountState | null>(null)
  const [loading, setLoading] = useState(false)
  const walletInstalled = typeof window !== 'undefined' && !!window.ethereum

  const loadAccountState = useCallback(async (addr: string) => {
    setLoading(true)
    try {
      const state = await api.getAccountState(addr)
      setAccountState(state)
    } catch (err) {
      console.error('Error loading account state:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshAccountState = useCallback(async () => {
    if (address) {
      await loadAccountState(address)
    }
  }, [address, loadAccountState])

  // Detect connected accounts on mount
  useEffect(() => {
    const provider = getProvider()
    if (!provider) return

    let handleAccountsChanged: ((accounts: string[]) => void) | null = null

    try {
      provider
        .request({ method: 'eth_accounts' })
        .then((accounts: string[]) => {
          if (accounts.length > 0) {
            setAddress(accounts[0])
            loadAccountState(accounts[0])
          }
        })
        .catch(() => {})

      handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) {
          setAddress(accounts[0])
          loadAccountState(accounts[0])
        } else {
          setAddress(null)
          setAccountState(null)
        }
      }

      provider.on('accountsChanged', handleAccountsChanged)
    } catch {
      // Wallet extension compatibility issue (Brave, Phantom, etc.)
    }

    // Also listen for our custom accountsChanged event (from WalletConnect)
    const handleCustomEvent = () => {
      try {
        provider
          .request({ method: 'eth_accounts' })
          .then((accounts: string[]) => {
            if (accounts.length > 0) {
              setAddress(accounts[0])
              loadAccountState(accounts[0])
            } else {
              setAddress(null)
              setAccountState(null)
            }
          })
          .catch(() => {})
      } catch {
        // ignore
      }
    }
    window.addEventListener('accountsChanged', handleCustomEvent)

    return () => {
      try {
        if (handleAccountsChanged) {
          provider.removeListener('accountsChanged', handleAccountsChanged)
        }
      } catch {
        // ignore cleanup errors
      }
      window.removeEventListener('accountsChanged', handleCustomEvent)
    }
  }, [loadAccountState])

  const switchToChain = useCallback(async (targetChainId: number): Promise<boolean> => {
    const provider = getProvider()
    if (!provider) return false

    const hexChainId = getChainHex(targetChainId)
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }],
      })
      return true
    } catch (switchError: any) {
      if (switchError.code === 4902 && CHAIN_INFO[targetChainId]) {
        try {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [{ chainId: hexChainId, ...CHAIN_INFO[targetChainId] }],
          })
          return true
        } catch {
          return false
        }
      }
      // User rejected or other error
      if (switchError.code === 4001) return false
      throw switchError
    }
  }, [])

  return {
    address,
    accountState,
    loading,
    walletInstalled,
    refreshAccountState,
    switchToChain,
  }
}
