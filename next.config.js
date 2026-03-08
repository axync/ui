/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/api/:path*',
      },
      {
        source: '/jsonrpc',
        destination: 'http://localhost:3000/jsonrpc',
      },
      {
        source: '/health',
        destination: 'http://localhost:3000/health',
      },
    ]
  },
}

module.exports = nextConfig

