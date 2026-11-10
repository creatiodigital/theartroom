import { withSentryConfig } from '@sentry/nextjs/config'

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@prisma/client', '@prisma/client-runtime-utils'],
  // Invoice PDFs render server-side with brand fonts + the wordmark read from
  // public/ via process.cwd() (see src/lib/invoices/InvoiceDocument.tsx) —
  // dynamic paths Vercel's file tracing cannot follow. Without this include,
  // the prod lambda lacks the files and every render throws ENOENT after the
  // invoice number is already committed.
  outputFileTracingIncludes: {
    '/*': ['public/fonts/**/*', 'public/email/**/*'],
  },
  // Stamp the deployed commit SHA into the client bundle so a running tab knows
  // which build it booted. Compared against the server's live SHA (/api/version)
  // to detect users stuck on a stale/cached version. Vercel sets
  // VERCEL_GIT_COMMIT_SHA at build; 'dev' locally.
  env: {
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || 'dev',
  },
  // `pnpm dev` blocks requests from other origins (Next 16.2+). Testing on a
  // phone over the home network reaches the dev server by its LAN address;
  // `*` matches exactly one part of the address. Dev server only.
  allowedDevOrigins: ['192.168.1.*'],
  experimental: {
    // Next 16.4 turned this on by default: a `next/dynamic` import with
    // `ssr: false` then calls React 19.3's `use(ReactDOM.browser(…))`. Our 3D
    // spaces are such imports rendered INSIDE the R3F <Canvas>, whose own React
    // reconciler (@react-three/fiber 9.5) predates that and throws "An
    // unsupported type was passed to use()" — every exhibition visit crashed.
    // Off = Next's earlier bailout, as before 16.4. Revisit with the R3F
    // upgrade (its own ticket).
    reactBrowserBailout: false,
  },
  images: {
    // No `dangerouslyAllowSVG`: nothing optimizes an SVG (icons are inlined via
    // SVGR, uploads are re-encoded to WebP), and letting the optimizer accept
    // SVG is its riskiest input. The CSP stays as a backstop.
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    deviceSizes: [640, 750, 828, 1024, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384, 400],
    // Our own assets only. (A `*.public.blob.vercel-storage.com` wildcard used
    // to sit here for legacy Vercel Blob URLs; none are left, and anyone can
    // create a Blob store under that wildcard.)
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.theartroom.gallery',
        pathname: '/**',
      },
    ],
  },

  // Cache headers for optimal performance
  async headers() {
    return [
      // Global security headers
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      // Static 3D assets - cache forever (1 year)
      {
        source: '/assets/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      // Visit routes - revalidate on each visit (exhibition data may change after publish)
      {
        source: '/exhibitions/:artistSlug/:exhibitionSlug/visit',
        headers: [{ key: 'Cache-Control', value: 'no-cache' }],
      },
      // Exhibition profile pages - revalidate (snapshot data may update)
      {
        source: '/exhibitions/:artistSlug/:exhibitionSlug',
        headers: [{ key: 'Cache-Control', value: 'no-cache' }],
      },
      // Exhibition API routes - revalidate
      {
        source: '/api/exhibitions/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-cache' }],
      },
      // Edit routes - never cache (artists need real-time updates)
      {
        source: '/exhibitions/:artistSlug/:exhibitionSlug/edit',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
    ]
  },

  webpack: (config) => {
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: ['@svgr/webpack'],
    })

    return config
  },

  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
}

export default withSentryConfig(nextConfig, {
  // Proxy client-side Sentry events through our own domain instead of
  // *.ingest.sentry.io, which ad blockers / privacy extensions / Brave block.
  // Without this, a large share of browser errors silently never arrive.
  tunnelRoute: '/monitoring',

  // Upload source maps for readable stack traces in Sentry
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Suppress Sentry CLI logs during build
  silent: !process.env.CI,

  // Disable Sentry telemetry
  telemetry: false,
})
