# Axync UI

Frontend for [Axync](https://axync.xyz) — cross-chain marketplace for tokens and vesting positions.

Built with Next.js 14, TypeScript, Tailwind CSS, and ethers.js.

## Pages

| Page | Route | Description |
|------|-------|-------------|
| Marketplace | `/` | Browse active deals, filter by tokens/NFTs |
| Create Deal | `/list` | List tokens or NFTs for cross-chain sale |
| Deal Details | `/listing/[id]` | View deal info, start purchase flow |
| Portfolio | `/portfolio` | Your deals, sequencer balances |

## Features

- Wallet connection (MetaMask, WalletConnect)
- ERC-20 token and ERC-721 NFT listing
- Cross-chain deal creation (choose asset chain + payment chain)
- Token contract lookup (auto-detect symbol, decimals, balance)
- EIP-712 signed purchase transactions
- Merkle proof claiming
- Real-time listing updates

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env with contract addresses

npm run dev
# Opens on http://localhost:3001
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API URL |
| `NEXT_PUBLIC_ETHEREUM_ESCROW_CONTRACT` | AxyncEscrow on Ethereum Sepolia |
| `NEXT_PUBLIC_ETHEREUM_VAULT_CONTRACT` | AxyncVault on Ethereum Sepolia |
| `NEXT_PUBLIC_BASE_ESCROW_CONTRACT` | AxyncEscrow on Base Sepolia |
| `NEXT_PUBLIC_BASE_VAULT_CONTRACT` | AxyncVault on Base Sepolia |
| `NEXT_PUBLIC_RPC_URL` | Ethereum Sepolia RPC |
| `NEXT_PUBLIC_BASE_RPC_URL` | Base Sepolia RPC |

## Docker

```bash
docker build \
  --build-arg NEXT_PUBLIC_API_URL=/api \
  --build-arg NEXT_PUBLIC_ETHEREUM_ESCROW_CONTRACT=0x... \
  -t axync/ui:latest .

docker run -p 3001:3001 axync/ui:latest
```

## License

MIT
