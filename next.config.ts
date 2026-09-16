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
      // @swc/helpers é usado em RUNTIME (next/dist/client/lib/console.js importa
      // _interop_require_default de lá) — excluir o escopo inteiro derrubou a
      // produção. Só os binários do compilador (@swc/core, específicos de
      // plataforma) são build-time; @swc/helpers fica de fora da exclusão.
      'node_modules/@swc/core/**',
      'node_modules/@swc/core-*/**',
      'node_modules/@esbuild/**',
      'node_modules/canvas/**',
      'node_modules/pdfjs-dist/standard_fonts/**',
      'node_modules/pdfjs-dist/cmaps/**',
      'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
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
