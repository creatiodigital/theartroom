import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { getEffectiveUserId } from '@/lib/authUtils'
import prisma from '@/lib/prisma'
import { secondLanguageOf } from '@/lib/roomLanguage'
import { generateUniqueSlug } from '@/lib/slugify'

// POST batch create artworks (requires auth)
export async function POST(request: NextRequest) {
  try {
    // Require authentication and get effective user ID
    const { userId, error: authError } = await getEffectiveUserId()
    if (authError) return authError

    const body = await request.json()
    const { artworks } = body as {
      artworks: Array<{
        id: string
        name: string
        artworkType: string
        title?: string
        author?: string
        year?: string
        technique?: string
        dimensions?: string
        description?: string
        textContent?: string
        textContentSecond?: string | null
        textContentSecondLang?: string | null
        featured?: boolean
        hiddenFromExhibition?: boolean
        originalWidth?: number | null
        originalHeight?: number | null
      }>
    }

    if (!artworks || !Array.isArray(artworks)) {
      return NextResponse.json({ error: 'artworks array is required' }, { status: 400 })
    }

    // Ownership gate for the upsert's UPDATE branch: the ids are
    // client-supplied, so without this check any signed-in user could pass
    // another artist's artwork id and overwrite their row (the CREATE branch
    // binds userId, but existing rows take the unscoped UPDATE path).
    const existing = await prisma.artwork.findMany({
      where: { id: { in: artworks.map((a) => a.id) } },
      select: { id: true, userId: true },
    })
    const foreign = existing.filter((row) => row.userId !== userId)
    if (foreign.length > 0) {
      return NextResponse.json(
        { error: 'One or more artworks belong to another user', ids: foreign.map((r) => r.id) },
        { status: 403 },
      )
    }

    // AR-182: the second-language text, only when sent (an absent key leaves it as it is). An empty
    // one is "same in both languages": stored as none, with its language.
    const secondText = (artwork: (typeof artworks)[number]) => {
      if (artwork.textContentSecond === undefined) return {}
      const text = artwork.textContentSecond?.trim() ? artwork.textContentSecond : null
      const lang = secondLanguageOf(artwork.textContentSecondLang)?.code ?? null
      return text && lang
        ? { textContentSecond: text, textContentSecondLang: lang }
        : { textContentSecond: null, textContentSecondLang: null }
    }

    // Use upsert to avoid duplicates (if artwork already exists, update it).
    //
    // `imageUrl` is deliberately NOT written here, even though the wall editor
    // sends it: the upload routes store it server-side, so the editor only ever
    // echoes that value back. Accepting it let any signed-in artist point their
    // artwork at someone else's file — and the next image replace or delete
    // would then delete that file from the bucket.
    const results = await Promise.all(
      artworks.map(async (artwork) => {
        const slug = await generateUniqueSlug(artwork.title || artwork.name || 'Untitled')
        return prisma.artwork.upsert({
          where: { id: artwork.id },
          create: {
            id: artwork.id,
            userId,
            name: artwork.name,
            slug,
            artworkType: artwork.artworkType || 'image',
            title: artwork.title || undefined,
            author: artwork.author || undefined,
            year: artwork.year || undefined,
            technique: artwork.technique || undefined,
            dimensions: artwork.dimensions || undefined,
            description: artwork.description || undefined,
            textContent: artwork.textContent || undefined,
            ...secondText(artwork),
            featured: artwork.featured ?? false,
            hiddenFromExhibition: artwork.hiddenFromExhibition ?? false,
            originalWidth: artwork.originalWidth ?? undefined,
            originalHeight: artwork.originalHeight ?? undefined,
          },
          update: {
            name: artwork.name,
            artworkType: artwork.artworkType || 'image',
            title: artwork.title || undefined,
            author: artwork.author || undefined,
            year: artwork.year || undefined,
            technique: artwork.technique || undefined,
            dimensions: artwork.dimensions || undefined,
            description: artwork.description || undefined,
            textContent: artwork.textContent || undefined,
            ...secondText(artwork),
            featured: artwork.featured ?? false,
            hiddenFromExhibition: artwork.hiddenFromExhibition ?? false,
            originalWidth: artwork.originalWidth ?? undefined,
            originalHeight: artwork.originalHeight ?? undefined,
          },
        })
      }),
    )

    return NextResponse.json({ count: results.length, artworks: results }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/artworks/batch] error:', error)
    return NextResponse.json({ error: 'Failed to create artworks' }, { status: 500 })
  }
}
