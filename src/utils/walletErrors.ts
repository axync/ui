/**
 * User-friendly wallet error messages
 *
 * Converts raw wallet/transaction errors into clean messages
 */

export function parseWalletError(err: any): string {
  if (!err) return 'Unknown error occurred.'

  const code = err?.code
  const msg = err?.message || err?.reason || String(err)

  // User rejected the transaction
  if (
    code === 4001 ||
    code === 'ACTION_REJECTED' ||
    msg.includes('user rejected') ||
    msg.includes('User rejected') ||
    msg.includes('ACTION_REJECTED') ||
    msg.includes('user denied') ||
    msg.includes('User denied')
  ) {
    return 'Transaction rejected. You declined the request in your wallet.'
  }

  // Insufficient funds
  if (
    msg.includes('INSUFFICIENT_FUNDS') ||
    msg.includes('insufficient funds') ||
    msg.includes('Insufficient funds')
  ) {
    return 'Insufficient funds in your wallet. Please add testnet ETH and try again.'
  }

  // Nonce issues
  if (msg.includes('nonce') || msg.includes('NONCE_EXPIRED')) {
    return 'Transaction nonce error. Please refresh the page and try again.'
  }

  // Chain/network switching
  if (code === 4902) {
    return 'This network is not added to your wallet. Please add it manually.'
  }
  if (msg.includes('wallet_switchEthereumChain') || msg.includes('Unrecognized chain')) {
    return 'Failed to switch network. Please switch manually in your wallet.'
  }

  // MetaMask not installed
  if (msg.includes('MetaMask') || msg.includes('No Ethereum provider')) {
    return 'No wallet detected. Please install MetaMask or another Web3 wallet.'
  }

  // Connection issues
  if (msg.includes('disconnected') || msg.includes('not connected')) {
    return 'Wallet disconnected. Please reconnect your wallet.'
  }

  // Timeout
  if (msg.includes('timeout') || msg.includes('TIMEOUT')) {
    return 'Request timed out. Please check your network connection and try again.'
  }

  // RPC errors
  if (msg.includes('Internal JSON-RPC error') || msg.includes('JSON-RPC')) {
    return 'Network error. The blockchain node may be temporarily unavailable. Please try again.'
  }

  // Gas estimation failed
  if (msg.includes('gas') && msg.includes('estimate')) {
    return 'Transaction may fail. Please check your inputs and try again.'
  }

  // Contract execution reverted
  if (msg.includes('execution reverted') || msg.includes('CALL_EXCEPTION')) {
    // Try to extract the revert reason
    const revertMatch = msg.match(/reason="([^"]+)"/)
    if (revertMatch) {
      return `Transaction failed: ${revertMatch[1]}`
    }
    return 'Transaction failed on-chain. The contract rejected the transaction.'
  }

  // Wallet extension compatibility
  if (msg.includes('addListener') || msg.includes('#S')) {
    return 'Wallet extension compatibility issue. Try using MetaMask or refreshing the page.'
  }

  // Network errors
  if (msg.includes('network') && msg.includes('changed')) {
    return 'Network changed during transaction. Please try again.'
  }
  if (msg.includes('NETWORK_ERROR') || msg.includes('could not detect network')) {
    return 'Network error. Please check your internet connection and wallet network settings.'
  }

  // API / backend errors
  if (msg.includes('Request failed') || msg.includes('status code')) {
    const statusMatch = msg.match(/status code (\d+)/)
    if (statusMatch) {
      const status = parseInt(statusMatch[1])
      if (status === 404) return 'Resource not found. Please check the deal ID or account.'
      if (status === 400) return 'Invalid request. Please check your inputs.'
      if (status === 500) return 'Server error. Please try again later.'
      if (status === 503) return 'Server temporarily unavailable. Please try again later.'
    }
    return 'Server communication error. Please try again.'
  }

  // Strip long hex/technical data for fallback
  const clean = msg
    .replace(/\(transaction=\{.*?\}\)/s, '')
    .replace(/\(action=.*?\)/s, '')
    .replace(/0x[a-fA-F0-9]{20,}/g, '0x...')
    .trim()

  return clean.length > 200 ? clean.slice(0, 200) + '...' : clean
}
