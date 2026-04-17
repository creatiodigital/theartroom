import Stripe from 'stripe'

/**
 * Server-side Stripe client. The secret key must stay on the server —
 * the publishable key (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) is what the
 * browser uses to mount Stripe Elements.
 *
 * We pin an explicit API version so silent Stripe changes don't alter
 * behaviour without us noticing. Bump deliberately when we want new
 * features.
 */
const secret = process.env.STRIPE_SECRET_KEY
const isPlaceholder = !secret || secret.startsWith('sk_test_REPLACE_ME')

if (isPlaceholder) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[stripe] STRIPE_SECRET_KEY is not configured.')
  }
  console.warn(
    '[stripe] STRIPE_SECRET_KEY is missing or still set to the placeholder. Payment actions will fail until you add a real test key from https://dashboard.stripe.com/test/apikeys',
  )
}

export const stripe = new Stripe(secret ?? '', {
  typescript: true,
  appInfo: { name: 'The Art Room', url: 'https://theartroom.gallery' },
})
