# ZKClear Frontend

ZKClear Frontend — institutional UI for creating, signing, and managing OTC settlements with zero-knowledge guarantees.

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Ethers.js** - Web3 integration
- **Axios** - HTTP client for API

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

The application will be available at `http://localhost:3001` (Next.js defaults to port 3000, but API is already on 3000, so we use 3001)

## Build

```bash
npm run build
npm start
```

## Project Structure (Next.js App Router)

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   ├── deposits/          # Deposits page
│   ├── deals/             # Deals pages
│   │   ├── create/       # Create deal page
│   │   └── [dealId]/     # Dynamic deal details
│   ├── withdrawals/       # Withdrawals page
│   └── account/           # Account page
├── components/            # React components
│   ├── wallet/           # Wallet components
│   └── Layout.tsx        # Main layout
├── services/              # API clients
│   └── api.ts            # API client
├── types/                 # TypeScript types
└── utils/                 # Utilities
    └── transactions.ts   # Transaction utilities
```

## API Integration

Frontend connects to ZKClear API through rewrites in `next.config.js`:
- `/api/*` → `http://localhost:3000/api/*`
- `/jsonrpc` → `http://localhost:3000/jsonrpc`

Make sure ZKClear API service is running on port 3000.

## Features

1. ✅ Basic project structure (Next.js + TypeScript)
2. ✅ App Router and Layout
3. ✅ Wallet connection component
4. ✅ API integration
5. ✅ Deposits page
6. ✅ Deals pages (list, create, details)
7. ✅ Withdrawals page
8. ✅ Account page

## Next Steps

- [ ] Transaction creation and signing
- [ ] Direct contract integration (DepositContract, WithdrawalContract)
- [ ] Deal list endpoint integration
- [ ] Transaction history
- [ ] Error handling and loading states
- [ ] Toast notifications
- [ ] Responsive design improvements

## License

MIT
