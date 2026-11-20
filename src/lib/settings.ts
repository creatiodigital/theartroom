import {
  DEFAULT_GALLERY_COMMISSION_PCT,
  isValidGalleryCommissionPct,
  type GalleryRates,
} from '@/lib/galleryCommission'
import prisma from '@/lib/prisma'
import { captureError } from '@/lib/observability/captureError'

// Single-row SiteSettings accessors (row id 1). Absence of the row means
// every flag sits at its default — the first toggle creates it.

/**
 * Emergency kill switch — when true, every public purchase surface hides
 * (prints catalog, Order Print CTAs, wizard, cart, checkout, deep links) and
 * new payment intents are refused. Read per request by the gated pages.
 *
 * FAILS OPEN (false): if the read errors — most importantly when the
 * SiteSettings table doesn't exist yet because a deploy landed before the
 * manual schema sync — the site keeps selling instead of 500ing the whole
 * purchase funnel. The pause is a best-effort gate, not a security boundary.
 */
export async function getPurchasesPaused(): Promise<boolean> {
  try {
    const settings = await prisma.siteSettings.findUnique({
      where: { id: 1 },
      select: { purchasesPaused: true },
    })
    return settings?.purchasesPaused ?? false
  } catch (err) {
    captureError(err, { flow: 'content', stage: 'purchases-paused-read', level: 'warning' })
    return false
  }
}

export async function setPurchasesPaused(paused: boolean): Promise<void> {
  await prisma.siteSettings.upsert({
    where: { id: 1 },
    update: { purchasesPaused: paused },
    create: { id: 1, purchasesPaused: paused },
  })
}

/**
 * Print presentations go-live switch — when true, grids and artwork pages show each work as a
 * photo of the real print, where a current one is rendered. Off by default, so a release can land
 * and every work be rendered before anyone sees it.
 *
 * FAILS CLOSED (false): if the read errors (e.g. the column isn't there yet because a deploy
 * landed before the schema sync), the site shows today's plain images.
 */
export async function getPrintPresentationsEnabled(): Promise<boolean> {
  try {
    const settings = await prisma.siteSettings.findUnique({
      where: { id: 1 },
      select: { printPresentationsEnabled: true },
    })
    return settings?.printPresentationsEnabled ?? false
  } catch (err) {
    captureError(err, { flow: 'content', stage: 'print-presentations-read', level: 'warning' })
    return false
  }
}

export async function setPrintPresentationsEnabled(enabled: boolean): Promise<void> {
  await prisma.siteSettings.upsert({
    where: { id: 1 },
    update: { printPresentationsEnabled: enabled },
    create: { id: 1, printPresentationsEnabled: enabled },
  })
}

/**
 * Last values read successfully in this server instance: what a failed read falls back to before
 * the default, so a blip never swaps the owner's commission for another one (pricing.md: "fails safe
 * to the last known value, never to 0").
 */
let lastKnownCommission: { pct: number; limitedPct: number } | null = null

export type GalleryCommission = {
  /** Open editions' commission, in percent. */
  pct: number
  /** Limited editions' commission, in percent (the open one until the owner saves its own). */
  limitedPct: number
  /** Last save, for "Last changed {date}". Null until the first save (or when the read failed). */
  changedAt: Date | null
  changedById: string | null
  /** The read failed and the percents are the fallback (last known values, else the default). */
  readFailed: boolean
}

/**
 * The gallery's commissions (pricing.md; formula in ../lib/galleryCommission): one for open
 * editions, one for limited editions. Read per request: a change in Admin › Sales › Pricing reaches
 * every price, the cart re-price and the next payment intent at once, no deploy.
 *
 * No row yet: the default (the column's own default). No limited commission saved yet (the column
 * is NULL): the open one, as before the two were split. FAILED read — e.g. a deploy that landed
 * before the schema sync — the last values this instance read, else the default; reported as an
 * error. Never 0, and never a 500 on every grid that shows a price.
 */
export async function getGalleryCommission(): Promise<GalleryCommission> {
  try {
    const settings = await prisma.siteSettings.findUnique({
      where: { id: 1 },
      select: {
        galleryCommissionPct: true,
        galleryCommissionLimitedPct: true,
        galleryCommissionChangedAt: true,
        galleryCommissionChangedById: true,
      },
    })
    const pct = settings?.galleryCommissionPct ?? DEFAULT_GALLERY_COMMISSION_PCT
    const limitedPct = settings?.galleryCommissionLimitedPct ?? pct
    lastKnownCommission = { pct, limitedPct }
    return {
      pct,
      limitedPct,
      changedAt: settings?.galleryCommissionChangedAt ?? null,
      changedById: settings?.galleryCommissionChangedById ?? null,
      readFailed: false,
    }
  } catch (err) {
    captureError(err, { flow: 'checkout', stage: 'gallery-commission-read', level: 'error' })
    return {
      pct: lastKnownCommission?.pct ?? DEFAULT_GALLERY_COMMISSION_PCT,
      limitedPct: lastKnownCommission?.limitedPct ?? DEFAULT_GALLERY_COMMISSION_PCT,
      changedAt: null,
      changedById: null,
      readFailed: true,
    }
  }
}

/** Both commissions as rates (30% → 0.3): what the price functions take, one per edition type. */
export async function getGalleryCommissionRates(): Promise<GalleryRates> {
  const { pct, limitedPct } = await getGalleryCommission()
  return { open: pct / 100, limited: limitedPct / 100 }
}

/** Save both commissions and stamp who and when. Returns the stamp, for "Last changed". */
export async function setGalleryCommissions(
  pcts: { pct: number; limitedPct: number },
  changedById: string,
): Promise<Date> {
  if (!isValidGalleryCommissionPct(pcts.pct) || !isValidGalleryCommissionPct(pcts.limitedPct)) {
    throw new Error('The commission must be a percentage from 0 to 100, with at most one decimal.')
  }
  const changedAt = new Date()
  const data = {
    galleryCommissionPct: pcts.pct,
    galleryCommissionLimitedPct: pcts.limitedPct,
    galleryCommissionChangedAt: changedAt,
    galleryCommissionChangedById: changedById,
  }
  await prisma.siteSettings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } })
  lastKnownCommission = { ...pcts }
  return changedAt
}
