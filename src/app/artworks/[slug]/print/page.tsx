import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { PrintWizard } from '@/components/PrintWizard'
import type { PrintOptions } from '@/components/PrintWizard/types'
import prisma from '@/lib/prisma'

interface PrintWizardPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PrintWizardPageProps): Promise<Metadata> {
  const { slug } = await params
  const artwork = await prisma.artwork.findUnique({
    where: { slug },
    select: { title: true, user: { select: { name: true, lastName: true } } },
  })

  if (!artwork) return { title: 'Print order' }

  const artistName = `${artwork.user.name} ${artwork.user.lastName}`
  return {
    title: { absolute: `Order a print — ${artwork.title} by ${artistName}` },
    robots: { index: false, follow: false },
  }
}

const PrintWizardPage = async ({ params }: PrintWizardPageProps) => {
  const { slug } = await params

  const artwork = await prisma.artwork.findUnique({
    where: { slug },
    include: {
      user: { select: { name: true, lastName: true } },
    },
  })

  if (!artwork || !artwork.imageUrl) {
    notFound()
  }
  // Print flow is gated per-artwork. If the artist hasn't enabled prints
  // (or hasn't set a price) a direct link to /print should 404 — the
  // public page already hides the "Buy Printable" CTA.
  if (!artwork.printEnabled || !artwork.printPriceCents) {
    notFound()
  }

  // Fall back to 1:1 if we don't have original pixel dimensions for some reason.
  const originalWidthPx = artwork.originalWidth ?? 1000
  const originalHeightPx = artwork.originalHeight ?? 1000

  const artistName = `${artwork.user.name} ${artwork.user.lastName}`

  return (
    <PrintWizard
      artwork={{
        slug: artwork.slug ?? slug,
        title: artwork.title ?? artwork.name,
        artistName,
        year: artwork.year ?? undefined,
        imageUrl: artwork.imageUrl,
        originalWidthPx,
        originalHeightPx,
        printPriceCents: artwork.printPriceCents,
        printOptions: (artwork.printOptions as PrintOptions | null) ?? null,
      }}
    />
  )
}

export default PrintWizardPage
