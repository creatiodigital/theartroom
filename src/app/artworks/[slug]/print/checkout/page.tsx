import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { PrintCheckout } from '@/components/PrintCheckout'
import { normalizePrintConfig } from '@/components/PrintWizard/options'
import type { PrintConfig } from '@/components/PrintWizard/types'
import prisma from '@/lib/prisma'

interface CheckoutPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export const metadata: Metadata = {
  title: { absolute: 'Checkout — The Art Room' },
  robots: { index: false, follow: false },
}

function pickString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0]
  return v
}

/**
 * Rebuild a PrintConfig from URL search params — this is the wizard's
 * handoff into checkout. Unknown/missing ids are repaired by
 * `normalizePrintConfig`, so a stale or hand-edited URL can't crash us.
 */
function readConfigFromParams(sp: Record<string, string | string[] | undefined>): PrintConfig {
  return normalizePrintConfig({
    paperId: (pickString(sp.paper) ?? 'museum-cotton-rag') as PrintConfig['paperId'],
    formatId: (pickString(sp.format) ?? 'classic-framed') as PrintConfig['formatId'],
    sizeId: (pickString(sp.size) ?? '30x40') as PrintConfig['sizeId'],
    frameColorId: (pickString(sp.color) ?? 'oak') as PrintConfig['frameColorId'],
    mountId: (pickString(sp.mount) ?? 'snow-white') as PrintConfig['mountId'],
    unit: 'cm',
    orientation: (pickString(sp.orientation) ?? 'portrait') as PrintConfig['orientation'],
  })
}

const CheckoutPage = async ({ params, searchParams }: CheckoutPageProps) => {
  const { slug } = await params
  const sp = await searchParams

  const artwork = await prisma.artwork.findUnique({
    where: { slug },
    include: {
      user: { select: { name: true, lastName: true } },
    },
  })

  if (!artwork || !artwork.imageUrl) notFound()
  if (!artwork.printEnabled || !artwork.printPriceCents) notFound()

  const config = readConfigFromParams(sp)
  const country = pickString(sp.country) ?? ''
  const artistName = `${artwork.user.name} ${artwork.user.lastName}`

  return (
    <PrintCheckout
      artwork={{
        slug: artwork.slug ?? slug,
        title: artwork.title ?? artwork.name,
        artistName,
        year: artwork.year ?? undefined,
        imageUrl: artwork.imageUrl,
        originalWidthPx: artwork.originalWidth ?? 1000,
        originalHeightPx: artwork.originalHeight ?? 1000,
        printPriceCents: artwork.printPriceCents,
      }}
      config={config}
      country={country}
    />
  )
}

export default CheckoutPage
