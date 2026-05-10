import path from 'node:path'

import { config as loadDotenv } from 'dotenv'

import { defineConfig, devices } from '@playwright/test'

// Load env files into process.env BEFORE any spec / helper imports
// run. Helpers transitively import Prisma, which throws if
// POSTGRES_PRISMA_URL is missing — so this has to happen first.
//   .env.local       — DB / Stripe / app config (shared with `pnpm dev`)
//   .env.test.local  — admin/artist credentials used by globalSetup +
//                      the auth specs. See .env.test.local.example.
const ROOT = __dirname
loadDotenv({ path: path.join(ROOT, '.env.local') })
loadDotenv({ path: path.join(ROOT, '.env.test.local'), override: true })

/**
 * Playwright configuration — local-only e2e tests.
 *
 * - Tests live in `./e2e`.
 * - Base URL defaults to `http://localhost:3001` — the same port as
 *   `pnpm dev`. Override with `PLAYWRIGHT_BASE_URL=http://localhost:4000 pnpm test:e2e`.
 * - `reuseExistingServer: false` — Playwright always spawns its own
 *   `next dev -p 3001` for the run. We need this so the email-skip
 *   env vars below actually land on the dev server's process (an
 *   already-running server has its own frozen env). Practical
 *   consequence: stop `pnpm dev` before running e2e, otherwise the
 *   spawn fails with "port 3001 already in use".
 * - We keep e2e on 3001 (instead of a separate port) so the existing
 *   Stripe CLI forwarder (`stripe listen --forward-to localhost:3001/...`)
 *   reaches the test server without any reconfiguration. The buyer +
 *   admin-lifecycle specs need that webhook to land for the PrintOrder
 *   row to get created.
 * - No CI-specific config: these tests are intentionally not wired
 *   into the build pipeline. Run them by hand with `pnpm test:e2e`.
 *
 * Email handling:
 *   - `pnpm test:e2e` (default, daily/pre-push): SKIP_EMAILS,
 *     SKIP_LOGIN_EMAIL, SKIP_LOGIN_OTP are all injected into the dev
 *     server, so no real Resend traffic leaves the suite.
 *   - `pnpm test:e2e:send-emails` (rare, manual verification): same
 *     suite but emails actually go out. Use only when verifying
 *     templates or end-to-end Resend delivery — burns the quota fast.
 *
 * Most specs are read-only by contract — they hit a shared dev /
 * staging DB and observe state without mutating it. The exceptions
 * are full-flow specs that exercise the buyer + admin pipelines
 * end-to-end (buyer-checkout, admin-order-lifecycle): those create
 * a real PrintOrder + Stripe test-mode PaymentIntent and clean up
 * after themselves in a `finally` block via cleanup-helpers.ts. New
 * specs should default to read-only; only opt in to writes when the
 * test target is the persistence pipeline itself.
 *
 * Other pre-requisites for the write specs:
 *   - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY + STRIPE_SECRET_KEY pointing
 *     at Stripe test-mode keys.
 *   - Local Stripe CLI webhook listener forwarding to /api/webhooks/stripe
 *     so the order row actually gets created.
 */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001'

// Default = suppress all email sends. Opt in to real sends with
// `pnpm test:e2e-no-skips`, which sets E2E_SEND_EMAILS=true.
const sendEmails = process.env.E2E_SEND_EMAILS === 'true'
const emailSkipEnv: Record<string, string> = sendEmails
  ? {}
  : {
      SKIP_EMAILS: 'true',
      SKIP_LOGIN_EMAIL: 'true',
      SKIP_LOGIN_OTP: 'true',
    }

export default defineConfig({
  testDir: './e2e',
  // globalSetup runs once before any spec. It logs in as admin and
  // artist via the UI and saves cookies to e2e/.auth/{admin,artist}.json
  // so authenticated specs don't each re-trigger send-login-code (which
  // rate-limits at 5/min per IP).
  globalSetup: './e2e/globalSetup.ts',
  // Sequential by default — most flows touch shared dev DB state, and
  // we'd rather not chase flake from parallel writes until we have a
  // reason to opt back in per-spec.
  fullyParallel: false,
  workers: 1,
  forbidOnly: false,
  // One auto-retry. The login specs (admin-login, artist-login) hit
  // /api/auth/send-login-code, which rate-limits at 5/min/IP — re-
  // running the suite within a minute can push us over the cap and
  // flake the very first auth spec. A single retry absorbs that blip
  // without slowing down clean runs.
  retries: 1,
  reporter: [['list']],

  use: {
    baseURL: BASE_URL,
    // Capture on failure only — keeps the run lean while still giving
    // you something useful when something breaks.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'next dev -p 3001',
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: emailSkipEnv,
  },
})
