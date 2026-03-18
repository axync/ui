'use client'

import { useState, useEffect } from 'react'

function getProvider(): typeof window.ethereum | null {
  if (typeof window === 'undefined') return null
  if (!window.ethereum) return null
  return window.ethereum
}

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
  address: string | null
  walletInstalled: boolean
}

export function useWallet(): UseWalletResult {
  const [address, setAddress] = useState<string | null>(null)
  const walletInstalled = typeof window !== 'undefined' && !!window.ethereum

  useEffect(() => {
    const provider = getProvider()
    if (!provider) return

    let lastAccount: string | null = null

    const checkAccounts = async () => {
      const accounts = await safeRequest('eth_accounts')
      if (!accounts) return

      const current = accounts.length > 0 ? accounts[0] : null
      if (current !== lastAccount) {
        lastAccount = current
        setAddress(current || null)
      }
    }

    checkAccounts()
    const interval = setInterval(checkAccounts, 2000)

    const handleCustomEvent = () => checkAccounts()
    window.addEventListener('accountsChanged', handleCustomEvent)

    return () => {
      clearInterval(interval)
      window.removeEventListener('accountsChanged', handleCustomEvent)
    }
  }, [])

  return { address, walletInstalled }
}
