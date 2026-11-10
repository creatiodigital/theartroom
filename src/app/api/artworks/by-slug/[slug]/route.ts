import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { auth } from '@/auth'
import { getArtworkMedia } from '@/lib/artwork/artworkMedia'
import { isAdminOrAbove } from '@/lib/authUtils'
import { buildArtworkCommerce, COMMERCE_SELECT } from '@/lib/editions/artworkCommerce'
import { LIVE_VARIANT_WHERE } from '@/lib/editions/printable'
import prisma from '@/lib/prisma'

export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params

    const artwork = await prisma.artwork.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        title: true,
        author: true,
        year: true,
        technique: true,
        dimensions: true,
        description: true,
        imageUrl: true,
        originalWidth: true,
        originalHeight: true,
        printEnabled: true,
        editionType: true,
        // The artist's cut — needed to cost the sale below, never sent.
        printPriceCents: true,
        // Live variants only. This is what makes a LIMITED edition buyable —
        // it carries no artwork-level price — and without it the exhibition
        // modal hid "Order Print" on every limited work.
        limitedVariants: {
          where: LIVE_VARIANT_WHERE,
          select: { id: true, ...COMMERCE_SELECT.limitedVariants.select },
        },
        user: {
          select: {
            id: true,
            name: true,
            lastName: true,
            handler: true,
            published: true,
          },
        },
      },
    })

    if (!artwork) {
      return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })
    }

    // An unpublished artist's works are hidden from the public. Their owner and
    // admins still need this modal — an admin reviews a new artist's show in
    // the 3D room before publishing the artist.
    if (!artwork.user.published) {
      const session = await auth()
      const privileged =
        isAdminOrAbove(session?.user?.userType) || session?.user?.id === artwork.user.id
      if (!privileged) {
        return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })
      }
    }

    const [availableNumberCount, commerce, media] = await Promise.all([
      // Numbers still available across the live variants — an exhibition
      // visitor must see "Sold out" rather than a CTA into a wizard that
      // refuses.
      artwork.limitedVariants.length > 0
        ? prisma.editionNumber.count({
            where: {
              variantId: { in: artwork.limitedVariants.map((v) => v.id) },
              state: 'available',
            },
          })
        : 0,
      // The same resolved payload the artwork page builds, so the two surfaces
      // describe a sale identically. It also replaces what used to be sent raw:
      // `printPriceCents` is the artist's cut, and shipping it to the browser
      // put the gallery's margin one subtraction away from any visitor.
      buildArtworkCommerce(artwork.id, artwork),
      // The modal mirrors the artwork page, so it needs the same supplementary
      // media. Empty for most works, which is the normal case.
      getArtworkMedia(artwork.id),
    ])

    const { published: _published, ...artist } = artwork.user

    return NextResponse.json({
      artwork: {
        id: artwork.id,
        slug: artwork.slug,
        name: artwork.name,
        title: artwork.title,
        author: artwork.author,
        year: artwork.year,
        technique: artwork.technique,
        dimensions: artwork.dimensions,
        description: artwork.description,
        imageUrl: artwork.imageUrl,
        originalWidth: artwork.originalWidth,
        originalHeight: artwork.originalHeight,
        printEnabled: artwork.printEnabled,
        editionType: artwork.editionType,
        liveVariantCount: artwork.limitedVariants.length,
        availableNumberCount,
      },
      artist,
      commerce,
      media,
    })
  } catch (error) {
    console.error('[GET /api/artworks/by-slug/[slug]] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
