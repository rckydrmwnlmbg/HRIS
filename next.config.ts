import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== 'production';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  output: 'standalone',
  // HANYA aktif saat npm run dev agar Turbopack tidak error membaca sqlserver.node.
  // Saat npm run build, ini akan hilang, sehingga menghindari bug hash 'Cannot find module mssql'.
  ...(isDev ? { serverExternalPackages: ['mssql', 'msnodesqlv8'] } : {})
};

export default nextConfig;