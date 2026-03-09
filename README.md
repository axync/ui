# Axync Web Application

Institutional web application for creating, signing, and managing cross-chain OTC settlements with zero-knowledge guarantees. Built with Next.js 14, TypeScript, Tailwind CSS, and ethers.js.

## Overview

Axync provides a secure, browser-based interface for institutional participants to negotiate and execute over-the-counter (OTC) settlement deals across multiple blockchain networks. The application leverages zero-knowledge proofs to ensure transaction privacy and correctness while maintaining full compatibility with the Axync Rust backend for cryptographic signing and proof verification.

## Features

- **MetaMask Wallet Integration** -- Connect and authenticate with MetaMask for seamless on-chain interactions
- **OTC Deal Management** -- Create, accept, and cancel OTC settlement deals through an intuitive interface
- **Multi-Chain Support** -- Deposit and withdraw assets across Ethereum Sepolia, Base Sepolia, and other supported networks
- **Transaction Signing** -- Client-side transaction construction and signing compatible with the Rust backend verification layer
- **Real-Time Account State** -- Live balance tracking and account state monitoring across connected chains
- **API Health Monitoring** -- Automatic backend connectivity checks with visual status indicators

## Tech Stack

| Layer         | Technology                          |
|---------------|-------------------------------------|
| Framework     | Next.js 14 (App Router)             |
| Language      | TypeScript                          |
| Styling       | Tailwind CSS                        |
| Web3          | ethers.js v6                        |
| HTTP Client   | Axios                               |
| Validation    | Zod                                 |
| Linting       | ESLint (Next.js config)             |

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- MetaMask browser extension
- Axync API backend running on port 3000

### Installation

```bash
# Clone the repository
git clone https://github.com/Alert17/axync-ui.git
cd axync-ui

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env.local
```

### Development

```bash
npm run dev
```

The application starts at `http://localhost:3001`. Port 3001 is used by default because the Axync API backend occupies port 3000.

### Production Build

```bash
npm run build
npm start
```

## Environment Variables

Copy `.env.example` to `.env.local` and configure the following variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Axync API backend URL | `http://localhost:3000` |
| `NEXT_PUBLIC_CHAIN_ID` | Default chain ID | `11155111` (Sepolia) |
| `NEXT_PUBLIC_RPC_URL` | JSON-RPC endpoint URL | Sepolia Infura endpoint |
| `NEXT_PUBLIC_APP_NAME` | Application display name | `Axync` |
| `NEXT_PUBLIC_APP_VERSION` | Application version | `0.1.0` |
| `NEXT_PUBLIC_ETHEREUM_DEPOSIT_CONTRACT` | Ethereum deposit contract address | `0x0...0` |
| `NEXT_PUBLIC_ETHEREUM_WITHDRAWAL_CONTRACT` | Ethereum withdrawal contract address | `0x0...0` |
| `NEXT_PUBLIC_ETHEREUM_VERIFIER_CONTRACT` | Ethereum verifier contract address | `0x0...0` |
| `NEXT_PUBLIC_BASE_DEPOSIT_CONTRACT` | Base deposit contract address | `0x0...0` |
| `NEXT_PUBLIC_BASE_WITHDRAWAL_CONTRACT` | Base withdrawal contract address | `0x0...0` |
| `NEXT_PUBLIC_BASE_VERIFIER_CONTRACT` | Base verifier contract address | `0x0...0` |

For local development with Hardhat, see the commented-out configuration in `.env.example`.

## Project Structure

```
src/
├── app/                        # Next.js App Router pages
│   ├── layout.tsx              # Root layout with metadata
│   ├── page.tsx                # Home / dashboard page
│   ├── globals.css             # Global styles
│   ├── deals/                  # Deal management pages
│   │   ├── page.tsx            # Deal list
│   │   ├── create/             # Deal creation form
│   │   └── [dealId]/           # Dynamic deal detail view
│   ├── deposits/               # Deposit management page
│   ├── withdrawals/            # Withdrawal management page
│   └── account/                # Account overview page
├── components/                 # Reusable React components
│   ├── Layout.tsx              # Main navigation layout
│   └── wallet/                 # Wallet connection components
├── services/                   # External service clients
│   └── api.ts                  # Axync API client (REST + JSON-RPC)
├── types/                      # TypeScript type definitions
└── utils/                      # Shared utilities
    └── transactions.ts         # Transaction construction helpers
```

## API Integration

The frontend communicates with the Axync backend through two channels configured as Next.js rewrites in `next.config.js`:

- **REST API** -- `/api/*` proxied to `http://localhost:3000/api/*` for deal CRUD, account queries, and health checks
- **JSON-RPC** -- `/jsonrpc` proxied to `http://localhost:3000/jsonrpc` for transaction submission and proof operations

Ensure the Axync API service is running on port 3000 before starting the frontend.

## Development

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server on port 3001 with hot reload |
| `npm run build` | Create optimized production build |
| `npm start` | Start production server on port 3001 |
| `npm run lint` | Run ESLint checks |

### Code Style

The project uses ESLint with the Next.js recommended configuration. Run `npm run lint` before committing to ensure code quality.

## Deployment

### Docker

Build and run the application in a container:

```bash
docker build -t axync-ui .
docker run -p 3001:3001 axync-ui
```

### Vercel

The application is compatible with Vercel deployment out of the box:

```bash
npx vercel
```

Set all `NEXT_PUBLIC_*` environment variables in the Vercel project settings.

### Static Export

For static hosting environments, add `output: 'export'` to `next.config.js` and run:

```bash
npm run build
```

The exported files will be in the `out/` directory.

## License

MIT
