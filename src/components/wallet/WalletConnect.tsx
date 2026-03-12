'use client'

import { useState, useEffect } from 'react'
import { formatAddress } from '@/utils/transactions'

export default function WalletConnect() {
  const [address, setAddress] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [walletInstalled, setWalletInstalled] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const provider = window.ethereum
    const hasWallet = !!provider
    setWalletInstalled(hasWallet)
    if (!hasWallet || !provider) return

    let lastAccount: string | null = null

    const checkAccounts = async () => {
      try {
        const accounts = await provider.request({ method: 'eth_accounts' })
        const current = accounts.length > 0 ? accounts[0] : null
        if (current !== lastAccount) {
          lastAccount = current
          setAddress(current)
        }
      } catch {
        // ignore
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

  const connectWallet = async () => {
    if (!window.ethereum) return

    setIsConnecting(true)
    try {
      try {
        await window.ethereum.request({
          method: 'wallet_revokePermissions',
          params: [{ eth_accounts: {} }],
        })
      } catch {
        // Ignore - permissions may not exist
      }

      await window.ethereum.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }],
      })

      const accounts = await window.ethereum.request({
        method: 'eth_accounts',
      })

      if (accounts.length > 0) {
        setAddress(accounts[0])
        window.dispatchEvent(new Event('accountsChanged'))
      }
    } catch (error: any) {
      if (error.code !== 4001) {
        console.error('Wallet connection error:', error)
      }
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnect = async () => {
    try {
      if (window.ethereum) {
        try {
          await window.ethereum.request({
            method: 'wallet_revokePermissions',
            params: [{ eth_accounts: {} }],
          })
        } catch {
          // Ignore
        }
      }
    } catch {
      // Ignore
    } finally {
      setAddress(null)
      window.dispatchEvent(new Event('accountsChanged'))
    }
  }

  if (address) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={disconnect}
          className="py-1.5 px-3.5 rounded-[9px] font-mono text-xs font-medium text-tx cursor-pointer transition-all"
          style={{
            background: 'linear-gradient(#12121A, #12121A) padding-box, linear-gradient(135deg, #CCCCFF, #7DD3FC) border-box',
            border: '1.5px solid transparent',
          }}
          title="Click to disconnect"
        >
          {formatAddress(address)}
        </button>
      </div>
    )
  }

  if (!walletInstalled) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-outline btn-sm"
      >
        Install Wallet
      </a>
    )
  }

  return (
    <button
      onClick={connectWallet}
      disabled={isConnecting}
      className="btn btn-outline btn-sm"
    >
      {isConnecting ? (
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 border border-tx3 border-t-transparent rounded-full animate-spin" />
          Connecting...
        </span>
      ) : (
        'Connect Wallet'
      )}
    </button>
  )
}
