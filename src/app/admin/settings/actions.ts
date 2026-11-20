'use server'

/**
 * Site-wide settings the admin changes: the purchases kill switch (dashboard) and the gallery's
 * commissions (Sales › Pricing) — see SiteSettings in schema.prisma.
 */
import { requireAdminAction } from '@/lib/authUtils'
import { isValidGalleryCommissionPct } from '@/lib/galleryCommission'
import { getPurchasesPaused, setGalleryCommissions, setPurchasesPaused } from '@/lib/settings'
import { captureError } from '@/lib/observability/captureError'

type SettingsResult = { ok: true; paused: boolean } | { ok: false; error: string }

export async function getPurchasesPausedState(): Promise<SettingsResult> {
  const guard = await requireAdminAction()
  if (!guard.ok) return { ok: false, error: guard.error }
  try {
    return { ok: true, paused: await getPurchasesPaused() }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to read settings.' }
  }
}

/**
 * Flip the emergency kill switch. Takes effect on the next request for every
 * public purchase surface (they all read the flag per request) — no deploy,
 * no per-artwork changes.
 */
export async function togglePurchasesPaused(paused: boolean): Promise<SettingsResult> {
  const guard = await requireAdminAction()
  if (!guard.ok) return { ok: false, error: guard.error }
  try {
    await setPurchasesPaused(paused)
    return { ok: true, paused }
  } catch (err) {
    captureError(err, { flow: 'admin', stage: 'toggle-purchases-paused' })
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update settings.' }
  }
}

type CommissionResult =
  | { ok: true; pct: number; limitedPct: number; changedAt: string }
  | { ok: false; error: string }

/**
 * Sales › Pricing (pricing.md): set the gallery's commissions, one for open editions and one for
 * limited editions (owner 2026-11-20), saved together. Every price on the site, cart re-prices at
 * checkout and new payment intents use them from the next request; placed orders keep their stored
 * prices and artists' payouts don't change. Records who and when.
 */
export async function saveGalleryCommission(pcts: {
  pct: number
  limitedPct: number
}): Promise<CommissionResult> {
  const guard = await requireAdminAction()
  if (!guard.ok) return { ok: false, error: guard.error }
  const { pct, limitedPct } = pcts ?? {}
  if (!isValidGalleryCommissionPct(pct) || !isValidGalleryCommissionPct(limitedPct)) {
    return { ok: false, error: 'Enter a percentage from 0 to 100, with one decimal at most.' }
  }
  try {
    const changedAt = await setGalleryCommissions({ pct, limitedPct }, guard.session.user.id)
    return { ok: true, pct, limitedPct, changedAt: changedAt.toISOString() }
  } catch (err) {
    captureError(err, { flow: 'admin', stage: 'save-gallery-commission' })
    return { ok: false, error: 'The commission wasn’t saved. Please try again.' }
  }
}
