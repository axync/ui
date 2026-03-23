/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  async rewrites() {
    const backend = process.env.BACKEND_URL || 'http://localhost:8080'
    return [
      {
        source: '/api/:path*',
        destination: `${backend}/api/:path*`,
      },
      {
        source: '/health',
        destination: `${backend}/health`,
      },
    ]
  },
}

module.exports = nextConfig

