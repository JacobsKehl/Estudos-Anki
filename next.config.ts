import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  // Impedir que o Next.js tente empacotar dependências pesadas ou do Electron na Nuvem
  serverExternalPackages: [
    'electron',
    'electron-builder',
    'tesseract.js',
    'pdfreader',
    'pdf2pic',
    'pdf-parse'
  ],
};

export default nextConfig;
