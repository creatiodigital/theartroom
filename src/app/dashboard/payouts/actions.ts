'use server'

import { headers } from 'next/headers'
import { unstable_cache } from 'next/cache'

import { getEffectiveUserId } from '@/lib/authUtils'
import prisma from '@/lib/prisma'
import { stripe } from '@/lib/stripe/client'

export type PayoutsStatus = {
  connected: boolean
  onboardingComplete: boolean
  /** True when Stripe reports missing info after onboarding — artist must resume. */
  detailsSubmitted: boolean
  /** True when Stripe will actually release payouts to the artist. */
  payoutsEnabled: boolean
  /** Email on file, for display. */
  email: string | null
}

export type ConnectCountry = { code: string; name: string }

// English country names from ISO 2-letter codes. Isolated here so we can
// fall back cleanly when a country isn't recognised by the runtime's Intl
// data.
const regionNames =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null

function countryName(code: string): string {
  return regionNames?.of(code) ?? code
}

/**
 * Fetch every country Stripe supports for Connect destination accounts.
 * The `country_specs` API is the authoritative source — each entry in it
 * is a country where `accounts.create({ country })` will succeed.
 *
 * Cached for 24h because this list rarely changes; Stripe adds a handful
 * of new countries a year. The cache is invalidated by process restart or
 * tag bust if we ever need to force a refresh.
 */
const fetchCountriesCached = unstable_cache(
  async (): Promise<ConnectCountry[]> => {
    const out: ConnectCountry[] = []
    // `country_specs` returns ~46 entries total; one page is enough but
    // the auto-paginator is trivially correct if Stripe ever adds more.
    for await (const spec of stripe.countrySpecs.list({ limit: 100 })) {
      out.push({ code: spec.id, name: countryName(spec.id) })
    }
    out.sort((a, b) => a.name.localeCompare(b.name))
    return out
  },
  ['stripe-connect-countries'],
  { revalidate: 60 * 60 * 24, tags: ['stripe-connect-countries'] },
)

export async function getConnectCountries(): Promise<
  { ok: true; countries: ConnectCountry[] } | { ok: false; error: string }
> {
  try {
    const countries = await fetchCountriesCached()
    return { ok: true, countries }
  } catch (err) {
    console.error('[payouts.getConnectCountries] Stripe failed:', err)
    return { ok: false, error: 'Could not load supported countries.' }
  }
}

/**
 * Read the artist's current Connect state. Always re-fetches from Stripe
 * so the UI reflects reality (our DB flag is eventually-consistent via
 * the account.updated webhook, and onboarding can stall mid-flow).
 */
export async function getPayoutsStatus(): Promise<
  { ok: true; status: PayoutsStatus } | { ok: false; error: string }
> {
  const { userId, error } = await getEffectiveUserId()
  if (error) return { ok: false, error: 'Not signed in.' }

  const user = await prisma.user.findUnique({
    where: { id: userId! },
    select: { stripeAccountId: true, stripeOnboardingComplete: true, email: true },
  })
  if (!user) return { ok: false, error: 'User not found.' }

  if (!user.stripeAccountId) {
    return {
      ok: true,
      status: {
        connected: false,
        onboardingComplete: false,
        detailsSubmitted: false,
        payoutsEnabled: false,
        email: user.email,
      },
    }
  }

  try {
    const acct = await stripe.accounts.retrieve(user.stripeAccountId)
    return {
      ok: true,
      status: {
        connected: true,
        onboardingComplete: Boolean(user.stripeOnboardingComplete),
        detailsSubmitted: Boolean(acct.details_submitted),
        payoutsEnabled: Boolean(acct.payouts_enabled),
        email: acct.email ?? user.email,
      },
    }
  } catch (err) {
    console.error('[payouts.getStatus] Stripe accounts.retrieve failed:', err)
    return { ok: false, error: 'Could not load payout status.' }
  }
}

/**
 * Create (or reuse) the artist's Connect account and return a short-lived
 * onboarding URL. The UI redirects the browser to this URL; Stripe hosts
 * the KYC + bank details flow and redirects back to `return_url` when done.
 *
 * Country is required the FIRST time we create the account (Stripe locks
 * it thereafter); subsequent calls just refresh the onboarding link.
 */
export async function createOnboardingLink(
  country?: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { userId, error } = await getEffectiveUserId()
  if (error) return { ok: false, error: 'Not signed in.' }

  const user = await prisma.user.findUnique({
    where: { id: userId! },
    select: { id: true, email: true, stripeAccountId: true },
  })
  if (!user) return { ok: false, error: 'User not found.' }
  if (!user.email) {
    return { ok: false, error: 'Add an email to your profile before connecting payouts.' }
  }

  const hdrs = await headers()
  const origin =
    hdrs.get('origin') ||
    `${hdrs.get('x-forwarded-proto') ?? 'https'}://${hdrs.get('host') ?? 'localhost:3000'}`

  try {
    let accountId = user.stripeAccountId

    if (!accountId) {
      if (!country) {
        return { ok: false, error: 'Please pick a country before connecting.' }
      }
      // Express = Stripe hosts onboarding + dashboard, collects KYC + bank
      // details for the chosen country. We only need the `transfers`
      // capability — money flow is: charge on our account, then transfer
      // to this account on shipment. Country is locked at creation.
      const acct = await stripe.accounts.create({
        type: 'express',
        country,
        email: user.email,
        capabilities: { transfers: { requested: true } },
        metadata: { userId: user.id },
      })
      accountId = acct.id
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeAccountId: accountId },
      })
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/dashboard/payouts?refresh=1`,
      return_url: `${origin}/dashboard/payouts?onboarded=1`,
      type: 'account_onboarding',
    })

    return { ok: true, url: link.url }
  } catch (err) {
    console.error('[payouts.createOnboardingLink] Stripe failed:', err)
    return { ok: false, error: 'Could not start onboarding. Please try again.' }
  }
}

/**
 * Disconnect the artist's Stripe Connect account. Deletes it from Stripe
 * (so the artist can start fresh later with a different country) and
 * clears our local fields. Returns the count of "unpaid" orders so the
 * UI can warn the artist before they commit.
 *
 * Stripe refuses to delete an account with a positive balance or open
 * disputes — we surface that error as-is.
 */
export async function disconnectAccount(): Promise<
  { ok: true; pendingOrders: number } | { ok: false; error: string }
> {
  const { userId, error } = await getEffectiveUserId()
  if (error) return { ok: false, error: 'Not signed in.' }

  const user = await prisma.user.findUnique({
    where: { id: userId! },
    select: { id: true, stripeAccountId: true },
  })
  if (!user) return { ok: false, error: 'User not found.' }
  if (!user.stripeAccountId) {
    return { ok: false, error: 'No Stripe account to disconnect.' }
  }

  const pendingOrders = await prisma.printOrder.count({
    where: {
      artistUserId: user.id,
      transferId: null,
      paymentStatus: 'succeeded',
    },
  })

  try {
    await stripe.accounts.del(user.stripeAccountId)
  } catch (err) {
    console.error('[payouts.disconnectAccount] Stripe failed:', err)
    const msg = err instanceof Error ? err.message : String(err)
    // Surface Stripe's own message (usually about unpaid balance / disputes)
    // so the artist can understand why they can't disconnect yet.
    return {
      ok: false,
      error: `Stripe refused to delete the account: ${msg}`,
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { stripeAccountId: null, stripeOnboardingComplete: false },
  })

  return { ok: true, pendingOrders }
}

/**
 * Surface a link to the Stripe Express dashboard so the artist can update
 * their bank details, see payouts, etc. Only valid once the account exists.
 */
export async function createDashboardLink(): Promise<
  { ok: true; url: string } | { ok: false; error: string }
> {
  const { userId, error } = await getEffectiveUserId()
  if (error) return { ok: false, error: 'Not signed in.' }

  const user = await prisma.user.findUnique({
    where: { id: userId! },
    select: { stripeAccountId: true },
  })
  if (!user?.stripeAccountId) return { ok: false, error: 'No connected account.' }

  try {
    const link = await stripe.accounts.createLoginLink(user.stripeAccountId)
    return { ok: true, url: link.url }
  } catch (err) {
    console.error('[payouts.createDashboardLink] Stripe failed:', err)
    return { ok: false, error: 'Could not open Stripe dashboard.' }
  }
}
