import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : 'standalone',
  typescript: {
    ignoreBuildErrors: false,
  },
  // Impedir que o Next.js tente empacotar dependências pesadas na Nuvem
  serverExternalPackages: [
    'tesseract.js',
    'pdfreader',
    'pdf2pic',
    'pdf-parse',
  ],
  outputFileTracingExcludes: {
    '*': [
      'node_modules/@swc/**',
      'node_modules/@esbuild/**',
      'node_modules/canvas/**',
      'node_modules/pdfjs-dist/standard_fonts/**',
      'node_modules/pdfjs-dist/cmaps/**',
      'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
      'node_modules/@prisma/engines/**',
      'node_modules/prisma/**',
      'node_modules/typescript/**',
      'node_modules/esbuild/**',
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
