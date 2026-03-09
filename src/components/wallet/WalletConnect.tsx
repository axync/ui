'use client'

import { useState, useEffect } from 'react'

export default function WalletConnect() {
  const [address, setAddress] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return

    let handleAccountsChanged: ((accounts: string[]) => void) | null = null

    try {
      window.ethereum
        .request({ method: 'eth_accounts' })
        .then((accounts: string[]) => {
          if (accounts.length > 0) {
            setAddress(accounts[0])
          }
        })
        .catch(() => {})

      handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) {
          setAddress(accounts[0])
        } else {
          setAddress(null)
        }
      }

      window.ethereum.on('accountsChanged', handleAccountsChanged)
    } catch {
      // Some wallets don't support .on() — ignore
    }

    return () => {
      try {
        if (handleAccountsChanged) {
          window.ethereum?.removeListener('accountsChanged', handleAccountsChanged)
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  }, [])

  const connectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      alert('Please install MetaMask!')
      return
    }

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
      if (error.code === 4001) {
        alert('Connection rejected. Please approve the connection request in MetaMask.')
      } else {
        alert('Failed to connect wallet: ' + (error.message || 'Unknown error'))
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

  return (
    <button
      onClick={connectWallet}
      disabled={isConnecting}
      className="btn-outline text-xs"
    >
      {isConnecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  )
}
