/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@prisma/client', '@prisma/client-runtime-utils'],
  images: {
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Custom sizes for our image optimization presets (thumbnail: 400, gallery3D: 1024, isolated: 2048)
    deviceSizes: [640, 750, 828, 1024, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384, 400],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.public.blob.vercel-storage.com',
      },
    ],
  },

  // Cache headers for optimal performance
  async headers() {
    return [
      // Static 3D assets - cache forever (1 year)
      {
        source: '/assets/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      // Draco decoder files - cache forever
      {
        source: '/draco/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      // Edit routes - never cache (artists need real-time updates)
      {
        source: '/:handler/exhibition/:slug/edit',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
      // View routes - cache at edge, stale-while-revalidate
      {
        source: '/:handler/exhibition/:slug',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=300' },
        ],
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

export default nextConfig
