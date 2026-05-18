import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  // Impedir que o Next.js tente empacotar dependências pesadas na Nuvem
  serverExternalPackages: [
    'tesseract.js',
    'pdfreader',
    'pdf2pic',
    'pdf-parse'
  ],
};

export default nextConfig;
