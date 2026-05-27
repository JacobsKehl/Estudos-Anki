import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: false,
  },
  // Impedir que o Next.js tente empacotar dependências pesadas na Nuvem
  serverExternalPackages: [
    'tesseract.js',
    'pdfreader',
    'pdf2pic',
    'pdf-parse'
  ],
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
