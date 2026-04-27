import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { PrintWizard } from '@/components/PrintWizard'
import { loadProviderCatalog } from '@/lib/print-providers/loadCatalog'
import { prodigiToWizardRestrictions, type PrintOptions } from '@/lib/print-providers/prodigi'
import type { PrintRestrictions, ProviderId } from '@/lib/print-providers'
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
  if (!artwork.printEnabled || !artwork.printPriceCents) {
    notFound()
  }

  const originalWidthPx = artwork.originalWidth ?? 1000
  const originalHeightPx = artwork.originalHeight ?? 1000
  const artistName = `${artwork.user.name} ${artwork.user.lastName}`

  // The artwork's chosen provider drives every adapter call. Pre-
  // migration, the column is absent → fallback to Prodigi.
  const providerId: ProviderId = artwork.printProvider === 'PRINTSPACE' ? 'printspace' : 'prodigi'

  const catalog = await loadProviderCatalog(providerId, {
    imageWidthPx: originalWidthPx,
    imageHeightPx: originalHeightPx,
  })

  const restrictions = readRestrictions(providerId, artwork.printOptions)

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
      }}
      catalog={catalog}
      restrictions={restrictions}
    />
  )
}

export default PrintWizardPage

function readRestrictions(providerId: ProviderId, raw: unknown): PrintRestrictions | null {
  if (!raw) return null
  if (providerId === 'prodigi') {
    return prodigiToWizardRestrictions(raw as PrintOptions)
  }
  // TPS-shaped restrictions arrive in the agnostic `PrintRestrictions`
  // shape directly; just pass through.
  return raw as PrintRestrictions
}
