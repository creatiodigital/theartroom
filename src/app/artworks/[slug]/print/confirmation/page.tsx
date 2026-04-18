import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { PrintConfirmation } from '@/components/PrintConfirmation'
import prisma from '@/lib/prisma'
import { stripe } from '@/lib/stripe/client'

interface ConfirmationPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export const metadata: Metadata = {
  title: { absolute: 'Order confirmed — The Art Room' },
  robots: { index: false, follow: false },
}

function pickString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0]
  return v
}

// Stripe's PI status → the three UI states the confirmation component
// knows about. `requires_capture` means the buyer's card is authorized
// (funds held) — from the buyer's perspective the order is placed, we
// just haven't captured yet. Treat it as success for the UI.
function mapStatus(status: string | undefined): 'succeeded' | 'processing' | 'failed' {
  if (status === 'succeeded' || status === 'requires_capture') return 'succeeded'
  if (status === 'processing') return 'processing'
  return 'failed'
}

const ConfirmationPage = async ({ params, searchParams }: ConfirmationPageProps) => {
  const { slug } = await params
  const sp = await searchParams

  const artwork = await prisma.artwork.findUnique({
    where: { slug },
    select: {
      slug: true,
      title: true,
      imageUrl: true,
      user: { select: { name: true, lastName: true } },
    },
  })

  if (!artwork) notFound()

  // Never trust `redirect_status` from the URL — re-fetch the PaymentIntent
  // from Stripe and use its real status. Also verify the PI actually
  // belongs to this artwork so a stolen pi_... can't be used to render a
  // success page under a different slug.
  const paymentIntentId = pickString(sp.payment_intent) ?? null
  let verifiedStatus: 'succeeded' | 'processing' | 'failed' | 'unknown' = 'unknown'

  if (paymentIntentId) {
    try {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
      const piSlug = pi.metadata?.artworkSlug
      if (piSlug && piSlug !== (artwork.slug ?? slug)) {
        verifiedStatus = 'failed'
      } else {
        verifiedStatus = mapStatus(pi.status)
      }
    } catch (err) {
      console.error('[confirmation] Could not retrieve PaymentIntent:', err)
      verifiedStatus = 'failed'
    }
  }

  const artistName = `${artwork.user.name} ${artwork.user.lastName}`

  return (
    <PrintConfirmation
      artwork={{
        slug: artwork.slug ?? slug,
        title: artwork.title ?? slug,
        imageUrl: artwork.imageUrl ?? '',
        artistName,
      }}
      paymentIntentId={verifiedStatus === 'succeeded' ? paymentIntentId : null}
      status={verifiedStatus}
    />
  )
}

export default ConfirmationPage
