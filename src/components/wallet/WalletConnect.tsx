'use client'

import { useState, useEffect } from 'react'

export default function WalletConnect() {
  const [address, setAddress] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [walletInstalled, setWalletInstalled] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check if wallet is installed
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

    // Initial check
    checkAccounts()

    // Poll for account changes (avoids provider.on which crashes some wallets)
    const interval = setInterval(checkAccounts, 2000)

    // Listen for our custom event (connect/disconnect dispatches this)
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
      // Only show errors that aren't user rejections — silently handle
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

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  // Wallet is connected — show address
  if (address) {
    return (
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs text-silver-lo bg-elevated px-3 py-1.5 rounded-lg border border-edge">
          {formatAddress(address)}
        </span>
        <button
          onClick={disconnect}
          className="text-xs text-dim hover:text-danger transition-colors"
        >
          Disconnect
        </button>
      </div>
    )
  }

  // No wallet extension installed
  if (!walletInstalled) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noopener noreferrer"
        className="btn-outline text-xs"
      >
        Install Wallet
      </a>
    )
  }

  // Wallet installed but not connected
  return (
    <button
      onClick={connectWallet}
      disabled={isConnecting}
      className="btn-outline text-xs"
    >
      {isConnecting ? (
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 border border-dim border-t-transparent rounded-full animate-spin" />
          Connecting...
        </span>
      ) : (
        'Connect Wallet'
      )}
    </button>
  )
}
