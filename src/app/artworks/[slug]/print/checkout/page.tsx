import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { PrintCheckout } from '@/components/checkout/PrintCheckout'
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
      providerId="printspace"
      country={country}
    />
  )
}

export default CheckoutPage
