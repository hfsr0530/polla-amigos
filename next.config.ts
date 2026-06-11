import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // PGlite trae WASM y se carga en runtime solo cuando no hay DATABASE_URL:
  // no debe pasar por el bundler
  serverExternalPackages: ['@electric-sql/pglite'],
}

export default nextConfig
