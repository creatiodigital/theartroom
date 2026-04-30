/**
 * Public-facing feature flags driven by env vars.
 *
 * Intentionally **safe-by-default in production**: in a prod build, both
 * flags are OFF unless explicitly turned on. In dev/staging they're ON
 * unless explicitly turned off. This way a prod deployment that forgets
 * to configure the flags still hides the public buying flow.
 *
 * To turn the flow on in prod when ready to launch:
 *   NEXT_PUBLIC_ENQUIRE_ENABLED=true
 *   NEXT_PUBLIC_PRINT_BUY_ENABLED=true
 *
 * To force-off in staging (rarely needed):
 *   NEXT_PUBLIC_ENQUIRE_ENABLED=false
 *   NEXT_PUBLIC_PRINT_BUY_ENABLED=false
 *
 * These are `NEXT_PUBLIC_*` so they're baked into the client bundle —
 * flipping them requires a redeploy. That's fine for the "launch"
 * moment — it's a conscious, deliberate event.
 *
 * Scope: these hide the public-facing buttons only. Admin dashboard,
 * Stripe webhooks, and the underlying routes/APIs keep
 * working so in-flight staging orders finish cleanly.
 */

const IS_PROD = process.env.NEXT_PUBLIC_APP_ENV === 'production'

function resolveFlag(envValue: string | undefined): boolean {
  if (IS_PROD) return envValue === 'true'
  return envValue !== 'false'
}

export const ENQUIRE_ENABLED = resolveFlag(process.env.NEXT_PUBLIC_ENQUIRE_ENABLED)

export const PRINT_BUY_ENABLED = resolveFlag(process.env.NEXT_PUBLIC_PRINT_BUY_ENABLED)
