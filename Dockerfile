FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Ensure public dir exists
RUN mkdir -p public

# Build args become env vars at build time
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_ETHEREUM_VAULT_CONTRACT
ARG NEXT_PUBLIC_ETHEREUM_VERIFIER_CONTRACT
ARG NEXT_PUBLIC_ETHEREUM_ESCROW_CONTRACT
ARG NEXT_PUBLIC_BASE_VAULT_CONTRACT
ARG NEXT_PUBLIC_BASE_VERIFIER_CONTRACT
ARG NEXT_PUBLIC_BASE_ESCROW_CONTRACT
ARG NEXT_PUBLIC_RPC_URL
ARG NEXT_PUBLIC_BASE_RPC_URL
ARG NEXT_PUBLIC_CHAIN_ID
ARG NEXT_PUBLIC_APP_NAME=Axync

RUN npm run build

# Runtime
FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3001
ENV PORT=3001
CMD ["node", "server.js"]
