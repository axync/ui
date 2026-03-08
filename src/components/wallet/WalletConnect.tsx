'use client'

import { useState, useEffect } from 'react'

export default function WalletConnect() {
  const [address, setAddress] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)

  // Check for already connected wallet on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum
        .request({ method: 'eth_accounts' })
        .then((accounts: string[]) => {
          if (accounts.length > 0) {
            setAddress(accounts[0])
          }
        })
        .catch(console.error)

      // Listen for account changes
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) {
          setAddress(accounts[0])
        } else {
          setAddress(null)
        }
      }

      window.ethereum.on('accountsChanged', handleAccountsChanged)

      return () => {
        window.ethereum?.removeListener('accountsChanged', handleAccountsChanged)
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
      // First, try to revoke existing permissions to force account selection
      try {
        await window.ethereum.request({
          method: 'wallet_revokePermissions',
          params: [{ eth_accounts: {} }],
        })
        console.log('🔓 Revoked existing permissions')
      } catch (revokeError: any) {
        // Ignore errors if no permissions exist
        if (revokeError.code !== -32602) {
          console.log('⚠️ Could not revoke permissions (may not exist):', revokeError)
        }
      }

      // Request new permissions - this will always show the account picker
      const permissions = await window.ethereum.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }],
      })
      console.log('🔌 Permissions granted:', permissions)

      // Get accounts after permissions are granted
      const accounts = await window.ethereum.request({
        method: 'eth_accounts',
      })
      console.log('🔌 Wallet connected:', accounts)
      
      if (accounts.length > 0) {
        setAddress(accounts[0])
        // Trigger accountsChanged event to notify all pages
        window.dispatchEvent(new Event('accountsChanged'))
      }
    } catch (error: any) {
      console.error('Error connecting wallet:', error)
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
      // Try to revoke permissions in MetaMask
      if (window.ethereum) {
        try {
          await window.ethereum.request({
            method: 'wallet_revokePermissions',
            params: [{ eth_accounts: {} }],
          })
          console.log('🔓 Permissions revoked in MetaMask')
        } catch (revokeError: any) {
          console.log('⚠️ Could not revoke permissions:', revokeError)
        }
      }
    } catch (error) {
      console.error('Error disconnecting:', error)
    } finally {
      // Always clear local state
      setAddress(null)
      // Trigger event to notify all pages
      window.dispatchEvent(new Event('accountsChanged'))
      console.log('🔓 Disconnected locally')
    }
  }

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  if (address) {
    return (
      <div className="flex items-center space-x-4">
        <span className="text-sm text-gray-700">{formatAddress(address)}</span>
        <button
          onClick={disconnect}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
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
      className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
    >
      {isConnecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  )
}
