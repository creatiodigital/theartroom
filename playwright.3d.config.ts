import fs from 'node:fs'
import path from 'node:path'

import { config as loadDotenv } from 'dotenv'

import { defineConfig, devices } from '@playwright/test'

/**
 * The 3D suite — `pnpm test:e2e:3d`. Never part of `pnpm test:e2e` or the pre-push hook: it opens
 * the real rooms (WebGL), which the main suite never does (owner, 2026-05-30: software WebGL pegs
 * the CPU and spins the fan). Run it after a dependency upgrade (next, react, three, R3F, drei)
 * and before a release. Added 2026-11-10, after a Next upgrade crashed every exhibition visit and
 * nothing in the main suite could see it.
 *
 * - Real GPU only: installed Chrome on the Mac's GPU (Metal), never SwiftShader. The `gpu` step
 *   checks the renderer first and stops the run before any room opens if it is software.
 * - A production build by default (`next build && next start`): what visitors get. Dev runs
 *   effects twice (StrictMode), so "each file once" only means something on a production build.
 *   `E2E_3D_DEV=true` runs on `next dev` instead (stop `pnpm dev` first: one dev server per folder).
 * - Port 3002, so `pnpm dev` can stay up on 3001 for a production-build run.
 * - Read-only: it visits the dev database's published shows, one per space, and writes nothing.
 */
const ROOT = __dirname
loadDotenv({ path: path.join(ROOT, '.env.local') })

// Never against production's data. `/peek-prod-db` points .env.local at the production
// database; this suite runs on dev only. Compares the URLs without printing either.
const prodEnvFile = path.join(ROOT, '.env.db.prod')
if (fs.existsSync(prodEnvFile)) {
  const prodUrl = fs
    .readFileSync(prodEnvFile, 'utf8')
    .split('\n')
    .find((line) => line.startsWith('POSTGRES_PRISMA_URL='))
    ?.slice('POSTGRES_PRISMA_URL='.length)
    .trim()
    .replace(/^["']|["']$/g, '')
  if (prodUrl && prodUrl === process.env.POSTGRES_PRISMA_URL) {
    throw new Error(
      '.env.local points at the PRODUCTION database (/peek-prod-db). Run /restore-dev-db first: ' +
        'the 3D suite runs on dev only.',
    )
  }
}

const PORT = 3002
const BASE_URL = `http://localhost:${PORT}`
const devServer = process.env.E2E_3D_DEV === 'true'

/** Installed Chrome on the real GPU: Metal through ANGLE, the GPU blocklist ignored. */
const chromeOnGpu = {
  ...devices['Desktop Chrome'],
  channel: 'chrome',
  launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] },
}

export default defineConfig({
  testDir: './e2e-3d',
  outputDir: './test-results/3d',
  // One room at a time: each is a cold first visit, and two at once would share the GPU.
  fullyParallel: false,
  workers: 1,
  // A room that fails once is a finding, not a flake to retry away.
  retries: 0,
  // Per room: the cold load of every file (the largest show has ~90 works) and its bake.
  timeout: 240_000,
  reporter: [['list']],

  use: {
    baseURL: BASE_URL,
    actionTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'gpu', testMatch: /gpu\.setup\.ts$/, use: chromeOnGpu },
    { name: 'rooms', testMatch: /\.spec\.ts$/, dependencies: ['gpu'], use: chromeOnGpu },
  ],

  webServer: {
    command: devServer ? `next dev -p ${PORT}` : `next build && next start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: devServer ? 120_000 : 420_000,
    // NextAuth issues sessions on localhost only with this in production mode (the visit page
    // reads the session); harmless on dev.
    env: { AUTH_TRUST_HOST: 'true' },
  },
})
