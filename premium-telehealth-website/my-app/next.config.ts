import type { NextConfig } from "next";
import { SECURITY_HEADERS } from "./lib/constants";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployments (not Netlify)
  output: process.env.NETLIFY ? undefined : 'standalone',

  // Turbopack configuration
  turbopack: {
    resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  
  // Enable gzip compression for responses
  compress: true,

  // Image optimization configuration
  images: {
    formats: ["image/webp", "image/avif"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.s3.amazonaws.com",
      },
    ],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Experimental features for performance
  experimental: {
    // Optimize package imports for faster builds and smaller bundles
    optimizePackageImports: [
      "@radix-ui/react-icons",
      "lucide-react",
      "framer-motion",
      "@aws-sdk/client-s3",
    ],
  },

  // HTTP headers for caching and security
  async headers() {
    return [
      // ============================================
      // Security Headers (All Routes)
      // ============================================
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: SECURITY_HEADERS['Content-Security-Policy'],
          },
          {
            key: "X-Frame-Options",
            value: SECURITY_HEADERS['X-Frame-Options'],
          },
          {
            key: "X-Content-Type-Options",
            value: SECURITY_HEADERS['X-Content-Type-Options'],
          },
          {
            key: "X-XSS-Protection",
            value: SECURITY_HEADERS['X-XSS-Protection'],
          },
          {
            key: "Referrer-Policy",
            value: SECURITY_HEADERS['Referrer-Policy'],
          },
          {
            key: "Permissions-Policy",
            value: SECURITY_HEADERS['Permissions-Policy'],
          },
          {
            key: "Strict-Transport-Security",
            value: SECURITY_HEADERS['Strict-Transport-Security'],
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: SECURITY_HEADERS['X-DNS-Prefetch-Control'],
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: SECURITY_HEADERS['Cross-Origin-Embedder-Policy'],
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: SECURITY_HEADERS['Cross-Origin-Opener-Policy'],
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: SECURITY_HEADERS['Cross-Origin-Resource-Policy'],
          },
        ],
      },
      // ============================================
      // API Routes
      // ============================================
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0, must-revalidate",
          },
          {
            key: "Content-Type",
            value: "application/json; charset=utf-8",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // API-specific CSP (stricter, no inline)
          {
            key: "Content-Security-Policy",
            value: "default-src 'none'; frame-ancestors 'none';",
          },
        ],
      },
      // ============================================
      // Static Assets
      // ============================================
      {
        source: "/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // ============================================
      // Images
      // ============================================
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      // ============================================
      // Fonts
      // ============================================
      {
        source: "/fonts/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // ============================================
      // Marketing Pages - ISR Caching
      // ============================================
      {
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=60, stale-while-revalidate=300",
          },
        ],
      },
      {
        source: "/about",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=60, stale-while-revalidate=300",
          },
        ],
      },
      {
        source: "/pricing",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=60, stale-while-revalidate=300",
          },
        ],
      },
      {
        source: "/faq",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=60, stale-while-revalidate=300",
          },
        ],
      },
      {
        source: "/how-it-works",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=60, stale-while-revalidate=300",
          },
        ],
      },
      {
        source: "/alcohol-treatment",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=60, stale-while-revalidate=300",
          },
        ],
      },
    ];
  },

  // Redirects configuration
  async redirects() {
    return [
      // Redirect old URLs to new ones
      {
        source: "/old-path",
        destination: "/new-path",
        permanent: true,
      },
    ];
  },

  // Webpack configuration for bundle optimization
  webpack: (config, { dev, isServer }) => {
    // Only optimize in production builds
    if (!dev && !isServer) {
      // Split chunks for better caching
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: "all",
          cacheGroups: {
            // Vendor chunk for node_modules
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: "vendors",
              chunks: "all",
              priority: 10,
            },
            // Common chunk for shared components
            common: {
              minChunks: 2,
              chunks: "all",
              enforce: true,
              priority: 5,
            },
            // UI components chunk
            ui: {
              test: /[\\/]components[\\/]ui[\\/]/,
              name: "ui-components",
              chunks: "all",
              priority: 8,
            },
          },
        },
      };
    }

    return config;
  },

  // TypeScript configuration
  typescript: {
    // CI environments may have module resolution differences
    ignoreBuildErrors: false,
  },

  // Environment variables that should be available at build time
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  },

  // Trailing slash configuration for SEO
  trailingSlash: false,

  // Powered by header - disable for security
  poweredByHeader: false,

  // React strict mode for development
  reactStrictMode: true,
};

export default nextConfig;
