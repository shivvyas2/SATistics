/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Photos on the developer page come from shivvyas.com
    remotePatterns: [{ protocol: 'https', hostname: 'www.shivvyas.com', pathname: '/images/**' }],
  },
  // Output configuration for Vercel
  output: 'standalone',
  
  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  },
}

module.exports = nextConfig

