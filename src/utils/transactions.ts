import { ethers } from 'ethers'

export interface DepositParams {
  txHash: string
  account: string
  assetId: number
  amount: bigint
  chainId: number
}

export interface WithdrawParams {
  assetId: number
  amount: bigint
  to: string
  chainId: number
}

export interface CreateDealParams {
  dealId: number
  visibility: 'public' | 'private'
  taker?: string
  assetBase: number
  assetQuote: number
  chainIdBase: number
  chainIdQuote: number
  amountBase: bigint
  priceQuotePerBase: bigint
}

export interface AcceptDealParams {
  dealId: number
  amount?: bigint
}

export interface CancelDealParams {
  dealId: number
}

/**
 * Create transaction hash for signing (Ethereum message format)
 */
export function createTxHash(
  from: string,
  nonce: number,
  kind: string,
  payload: any
): string {
  const message = ethers.solidityPackedKeccak256(
    ['address', 'uint64', 'uint8', 'bytes'],
    [
      from,
      nonce,
      getKindByte(kind),
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes'],
        [ethers.toUtf8Bytes(JSON.stringify(payload))]
      ),
    ]
  )

  // Ethereum signed message prefix
  const prefix = '\x19Ethereum Signed Message:\n' + String(message.length)
  return ethers.solidityPackedKeccak256(
    ['string', 'bytes32'],
    [prefix, message]
  )
}

function getKindByte(kind: string): number {
  switch (kind) {
    case 'Deposit':
      return 0
    case 'Withdraw':
      return 1
    case 'CreateDeal':
      return 2
    case 'AcceptDeal':
      return 3
    case 'CancelDeal':
      return 4
    default:
      throw new Error(`Unknown transaction kind: ${kind}`)
  }
}

/**
 * Sign transaction with wallet
 */
export async function signTransaction(
  signer: ethers.Signer,
  from: string,
  nonce: number,
  kind: string,
  payload: any
): Promise<string> {
  const messageHash = createTxHash(from, nonce, kind, payload)
  const signature = await signer.signMessage(ethers.getBytes(messageHash))
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

/**
 * Create transaction hash for signing (matches Rust tx_hash function)
 */
export function createTxHashForSigning(
  from: string,
  nonce: number,
  kind: string,
  payload: any
): Uint8Array {
  const fromBytes = ethers.getBytes(from)
  const nonceBytes = new Uint8Array(8)
  const nonceView = new DataView(nonceBytes.buffer)
  nonceView.setBigUint64(0, BigInt(nonce), true) // little-endian

  const kindByte = getKindByte(kind)

  // Build payload bytes based on kind
  let payloadBytes = new Uint8Array(0)
  switch (kind) {
    case 'Deposit': {
      const txHashBytes = ethers.getBytes(payload.txHash)
      const accountBytes = ethers.getBytes(payload.account)
      const assetIdBytes = new Uint8Array(2)
      const assetIdView = new DataView(assetIdBytes.buffer)
      assetIdView.setUint16(0, payload.assetId, true)
      const amountBytes = new Uint8Array(16)
      const amountView = new DataView(amountBytes.buffer)
      amountView.setBigUint64(0, BigInt(payload.amount), true)
      amountView.setBigUint64(8, BigInt(0), true)
      const chainIdBytes = new Uint8Array(4)
      const chainIdView = new DataView(chainIdBytes.buffer)
      chainIdView.setUint32(0, payload.chainId, true)

      payloadBytes = new Uint8Array(
        txHashBytes.length +
          accountBytes.length +
          assetIdBytes.length +
          amountBytes.length +
          chainIdBytes.length
      )
      let offset = 0
      payloadBytes.set(txHashBytes, offset)
      offset += txHashBytes.length
      payloadBytes.set(accountBytes, offset)
      offset += accountBytes.length
      payloadBytes.set(assetIdBytes, offset)
      offset += assetIdBytes.length
      payloadBytes.set(amountBytes, offset)
      offset += amountBytes.length
      payloadBytes.set(chainIdBytes, offset)
      break
    }
    case 'CreateDeal': {
      const dealIdBytes = new Uint8Array(8)
      const dealIdView = new DataView(dealIdBytes.buffer)
      dealIdView.setBigUint64(0, BigInt(payload.dealId), true)
      const visibilityByte = payload.visibility === 'Public' ? 0 : 1
      const takerBytes = payload.taker ? ethers.getBytes(payload.taker) : null
      const assetBaseBytes = new Uint8Array(2)
      const assetBaseView = new DataView(assetBaseBytes.buffer)
      assetBaseView.setUint16(0, payload.assetBase, true)
      const assetQuoteBytes = new Uint8Array(2)
      const assetQuoteView = new DataView(assetQuoteBytes.buffer)
      assetQuoteView.setUint16(0, payload.assetQuote, true)
      const chainIdBaseBytes = new Uint8Array(4)
      const chainIdBaseView = new DataView(chainIdBaseBytes.buffer)
      chainIdBaseView.setUint32(0, payload.chainIdBase, true)
      const chainIdQuoteBytes = new Uint8Array(4)
      const chainIdQuoteView = new DataView(chainIdQuoteBytes.buffer)
      chainIdQuoteView.setUint32(0, payload.chainIdQuote, true)
      const amountBaseBytes = new Uint8Array(16)
      const amountBaseView = new DataView(amountBaseBytes.buffer)
      amountBaseView.setBigUint64(0, BigInt(payload.amountBase), true)
      amountBaseView.setBigUint64(8, BigInt(0), true)
      const priceBytes = new Uint8Array(16)
      const priceView = new DataView(priceBytes.buffer)
      priceView.setBigUint64(0, BigInt(payload.priceQuotePerBase), true)
      priceView.setBigUint64(8, BigInt(0), true)

      const totalLength =
        dealIdBytes.length +
        1 + // visibility
        1 + // taker flag
        (takerBytes ? takerBytes.length : 0) +
        assetBaseBytes.length +
        assetQuoteBytes.length +
        chainIdBaseBytes.length +
        chainIdQuoteBytes.length +
        amountBaseBytes.length +
        priceBytes.length

      payloadBytes = new Uint8Array(totalLength)
      let offset = 0
      payloadBytes.set(dealIdBytes, offset)
      offset += dealIdBytes.length
      payloadBytes[offset++] = visibilityByte
      if (takerBytes) {
        payloadBytes[offset++] = 1
        payloadBytes.set(takerBytes, offset)
        offset += takerBytes.length
      } else {
        payloadBytes[offset++] = 0
      }
      payloadBytes.set(assetBaseBytes, offset)
      offset += assetBaseBytes.length
      payloadBytes.set(assetQuoteBytes, offset)
      offset += assetQuoteBytes.length
      payloadBytes.set(chainIdBaseBytes, offset)
      offset += chainIdBaseBytes.length
      payloadBytes.set(chainIdQuoteBytes, offset)
      offset += chainIdQuoteBytes.length
      payloadBytes.set(amountBaseBytes, offset)
      offset += amountBaseBytes.length
      payloadBytes.set(priceBytes, offset)
      break
    }
    default:
      throw new Error(`Unsupported transaction kind: ${kind}`)
  }

  // Combine all parts
  const data = new Uint8Array(
    fromBytes.length + nonceBytes.length + 1 + payloadBytes.length
  )
  let offset = 0
  data.set(fromBytes, offset)
  offset += fromBytes.length
  data.set(nonceBytes, offset)
  offset += nonceBytes.length
  data[offset++] = kindByte
  data.set(payloadBytes, offset)

  // Add Ethereum signed message prefix
  const prefix = new TextEncoder().encode('\x19Ethereum Signed Message:\n')
  const messageLen = data.length.toString()
  const messageLenBytes = new TextEncoder().encode(messageLen)
  const prefixed = new Uint8Array(
    prefix.length + messageLenBytes.length + data.length
  )
  offset = 0
  prefixed.set(prefix, offset)
  offset += prefix.length
  prefixed.set(messageLenBytes, offset)
  offset += messageLenBytes.length
  prefixed.set(data, offset)

  return prefixed
}

/**
 * Sign transaction with wallet (using correct hash format)
 * Note: This creates the message in the same format as Rust tx_hash function
 */
export async function signTransactionCorrect(
  signer: ethers.Signer,
  from: string,
  nonce: number,
  kind: string,
  payload: any
): Promise<string> {
  // Create message bytes (without prefix, as signMessage will add it)
  const fromBytes = ethers.getBytes(from)
  const nonceBytes = new Uint8Array(8)
  const nonceView = new DataView(nonceBytes.buffer)
  nonceView.setBigUint64(0, BigInt(nonce), true) // little-endian

  const kindByte = getKindByte(kind)

  // Build payload bytes based on kind
  let payloadBytes = new Uint8Array(0)
  switch (kind) {
    case 'Deposit': {
      const txHashBytes = ethers.getBytes(payload.txHash)
      const accountBytes = ethers.getBytes(payload.account)
      const assetIdBytes = new Uint8Array(2)
      const assetIdView = new DataView(assetIdBytes.buffer)
      assetIdView.setUint16(0, payload.assetId, true)
      const amountBytes = new Uint8Array(16)
      const amountView = new DataView(amountBytes.buffer)
      amountView.setBigUint64(0, BigInt(payload.amount), true)
      amountView.setBigUint64(8, BigInt(0), true)
      const chainIdBytes = new Uint8Array(4)
      const chainIdView = new DataView(chainIdBytes.buffer)
      chainIdView.setUint32(0, payload.chainId, true)

      payloadBytes = new Uint8Array(
        txHashBytes.length +
          accountBytes.length +
          assetIdBytes.length +
          amountBytes.length +
          chainIdBytes.length
      )
      let offset = 0
      payloadBytes.set(txHashBytes, offset)
      offset += txHashBytes.length
      payloadBytes.set(accountBytes, offset)
      offset += accountBytes.length
      payloadBytes.set(assetIdBytes, offset)
      offset += assetIdBytes.length
      payloadBytes.set(amountBytes, offset)
      offset += amountBytes.length
      payloadBytes.set(chainIdBytes, offset)
      break
    }
    case 'CreateDeal': {
      const dealIdBytes = new Uint8Array(8)
      const dealIdView = new DataView(dealIdBytes.buffer)
      dealIdView.setBigUint64(0, BigInt(payload.dealId), true)
      const visibilityByte = payload.visibility === 'Public' ? 0 : 1
      const takerBytes = payload.taker ? ethers.getBytes(payload.taker) : null
      const assetBaseBytes = new Uint8Array(2)
      const assetBaseView = new DataView(assetBaseBytes.buffer)
      assetBaseView.setUint16(0, payload.assetBase, true)
      const assetQuoteBytes = new Uint8Array(2)
      const assetQuoteView = new DataView(assetQuoteBytes.buffer)
      assetQuoteView.setUint16(0, payload.assetQuote, true)
      const chainIdBaseBytes = new Uint8Array(4)
      const chainIdBaseView = new DataView(chainIdBaseBytes.buffer)
      chainIdBaseView.setUint32(0, payload.chainIdBase, true)
      const chainIdQuoteBytes = new Uint8Array(4)
      const chainIdQuoteView = new DataView(chainIdQuoteBytes.buffer)
      chainIdQuoteView.setUint32(0, payload.chainIdQuote, true)
      const amountBaseBytes = new Uint8Array(16)
      const amountBaseView = new DataView(amountBaseBytes.buffer)
      amountBaseView.setBigUint64(0, BigInt(payload.amountBase), true)
      amountBaseView.setBigUint64(8, BigInt(0), true)
      const priceBytes = new Uint8Array(16)
      const priceView = new DataView(priceBytes.buffer)
      priceView.setBigUint64(0, BigInt(payload.priceQuotePerBase), true)
      priceView.setBigUint64(8, BigInt(0), true)

      const totalLength =
        dealIdBytes.length +
        1 + // visibility
        1 + // taker flag
        (takerBytes ? takerBytes.length : 0) +
        assetBaseBytes.length +
        assetQuoteBytes.length +
        chainIdBaseBytes.length +
        chainIdQuoteBytes.length +
        amountBaseBytes.length +
        priceBytes.length

      payloadBytes = new Uint8Array(totalLength)
      let offset = 0
      payloadBytes.set(dealIdBytes, offset)
      offset += dealIdBytes.length
      payloadBytes[offset++] = visibilityByte
      if (takerBytes) {
        payloadBytes[offset++] = 1
        payloadBytes.set(takerBytes, offset)
        offset += takerBytes.length
      } else {
        payloadBytes[offset++] = 0
      }
      payloadBytes.set(assetBaseBytes, offset)
      offset += assetBaseBytes.length
      payloadBytes.set(assetQuoteBytes, offset)
      offset += assetQuoteBytes.length
      payloadBytes.set(chainIdBaseBytes, offset)
      offset += chainIdBaseBytes.length
      payloadBytes.set(chainIdQuoteBytes, offset)
      offset += chainIdQuoteBytes.length
      payloadBytes.set(amountBaseBytes, offset)
      offset += amountBaseBytes.length
      payloadBytes.set(priceBytes, offset)
      break
    }
    case 'AcceptDeal': {
      const dealIdBytes = new Uint8Array(8)
      const dealIdView = new DataView(dealIdBytes.buffer)
      dealIdView.setBigUint64(0, BigInt(payload.dealId), true)
      const hasAmount = payload.amount !== null && payload.amount !== undefined
      const amountBytes = hasAmount
        ? (() => {
            const bytes = new Uint8Array(16)
            const view = new DataView(bytes.buffer)
            view.setBigUint64(0, BigInt(payload.amount), true)
            view.setBigUint64(8, BigInt(0), true)
            return bytes
          })()
        : null

      const totalLength = dealIdBytes.length + 1 + (amountBytes ? amountBytes.length : 0)
      payloadBytes = new Uint8Array(totalLength)
      let offset = 0
      payloadBytes.set(dealIdBytes, offset)
      offset += dealIdBytes.length
      if (amountBytes) {
        payloadBytes[offset++] = 1
        payloadBytes.set(amountBytes, offset)
      } else {
        payloadBytes[offset++] = 0
      }
      break
    }
    case 'CancelDeal': {
      const dealIdBytes = new Uint8Array(8)
      const dealIdView = new DataView(dealIdBytes.buffer)
      dealIdView.setBigUint64(0, BigInt(payload.dealId), true)
      payloadBytes = dealIdBytes
      break
    }
    case 'Withdraw': {
      const assetIdBytes = new Uint8Array(2)
      const assetIdView = new DataView(assetIdBytes.buffer)
      assetIdView.setUint16(0, payload.assetId, true)
      const amountBytes = new Uint8Array(16)
      const amountView = new DataView(amountBytes.buffer)
      amountView.setBigUint64(0, BigInt(payload.amount), true)
      amountView.setBigUint64(8, BigInt(0), true)
      const toBytes = ethers.getBytes(payload.to)
      const chainIdBytes = new Uint8Array(4)
      const chainIdView = new DataView(chainIdBytes.buffer)
      chainIdView.setUint32(0, payload.chainId, true)

      payloadBytes = new Uint8Array(
        assetIdBytes.length +
          amountBytes.length +
          toBytes.length +
          chainIdBytes.length
      )
      let offset = 0
      payloadBytes.set(assetIdBytes, offset)
      offset += assetIdBytes.length
      payloadBytes.set(amountBytes, offset)
      offset += amountBytes.length
      payloadBytes.set(toBytes, offset)
      offset += toBytes.length
      payloadBytes.set(chainIdBytes, offset)
      break
    }
    default:
      throw new Error(`Unsupported transaction kind: ${kind}`)
  }

  // Combine all parts: from + nonce + kind + payload
  const data = new Uint8Array(
    fromBytes.length + nonceBytes.length + 1 + payloadBytes.length
  )
  let offset = 0
  data.set(fromBytes, offset)
  offset += fromBytes.length
  data.set(nonceBytes, offset)
  offset += nonceBytes.length
  data[offset++] = kindByte
  data.set(payloadBytes, offset)

  // Use signMessage which will add prefix and hash automatically
  // It will create: Keccak256("\x19Ethereum Signed Message:\n" + len + data)
  // Which matches the Rust format
  const signature = await signer.signMessage(data)
  return signature
}

