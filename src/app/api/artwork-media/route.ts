import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { auth } from '@/auth'
import { getArtworkMedia, mediaLimitsFor } from '@/lib/artwork/artworkMedia'
import { isObjectMediaRole } from '@/lib/artwork/objectArtwork'
import { isValidImageType } from '@/lib/imageProcessor'
import { captureError } from '@/lib/observability/captureError'
import prisma from '@/lib/prisma'
import {
  buildArtworkSupplementaryKey,
  deleteFromR2,
  deleteR2KeyDirect,
  getPresignedUploadUrl,
  getR2ObjectSize,
} from '@/lib/r2'
import { rateLimit } from '@/lib/rateLimit'
import { isValidVideoType } from '@/lib/videoType'
import { sanitizeLine } from '@/utils/sanitizeLine'

/**
 * Supplementary artwork media — upload and removal.
 *
 * Admins, for any artwork: the gallery's sales presentation, deliberately
 * narrower than the main image beside it (artist-or-admin). The one exception is
 * an Object (docs/objects): its photos and reels are how the artist shows the
 * piece, so its own artist manages them too.
 *
 * Modelled on /api/upload/image, which is the house pattern: ownership checked
 * on BOTH steps, a MIME allowlist, the declared size AND the real one, a key
 * shape bound to this specific artwork, no client-supplied URL anywhere, and
 * magic-byte validation of what actually landed.
 */
const ALLOWED = {
  'image/jpeg': { ext: 'jpg', kind: 'image' as const, max: 25 * 1024 * 1024 },
  'image/png': { ext: 'png', kind: 'image' as const, max: 25 * 1024 * 1024 },
  'image/webp': { ext: 'webp', kind: 'image' as const, max: 25 * 1024 * 1024 },
  'video/mp4': { ext: 'mp4', kind: 'video' as const, max: 20 * 1024 * 1024 },
  'video/webm': { ext: 'webm', kind: 'video' as const, max: 20 * 1024 * 1024 },
}

/**
 * Keys we minted, and no others:
 *   <env>/artists/<handler>/<artworkId>/supplementary/<suffix>.<ext>
 */
const KEY_RE =
  /^[a-z0-9-]+\/artists\/[a-z0-9-]+\/[a-zA-Z0-9_-]+\/supplementary\/[a-zA-Z0-9]+\.(jpg|png|webp|mp4|webm)$/

function isSafeKey(key: unknown, artworkId: string): key is string {
  if (typeof key !== 'string' || key.length === 0 || key.length > 256) return false
  if (key.includes('..') || key.includes('//')) return false
  if (!KEY_RE.test(key)) return false
  // Must sit under THIS artwork's folder — a well-formed key belonging to
  // another artwork is still someone else's object.
  return key.includes(`/${artworkId}/supplementary/`)
}

const MB = 1024 * 1024

/** An Object's videos are reels and films of the piece (up to 3 min), so they may be larger. */
const maxBytesFor = (kind: 'image' | 'video', artworkType: string) =>
  kind === 'image' ? 25 * MB : artworkType === 'object' ? 50 * MB : 20 * MB

/**
 * Who may manage this artwork's media: an admin, or the artist for their own
 * Object. Checked against the artwork the request names (or the row's artwork).
 */
async function requireMediaAccess(artworkId: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated', status: 401 as const }
  const artwork = await prisma.artwork.findUnique({
    where: { id: artworkId },
    select: { userId: true, artworkType: true },
  })
  if (!artwork) return { error: 'Artwork not found', status: 404 as const }
  const t = session.user.userType
  const isAdmin = t === 'admin' || t === 'superAdmin'
  const ownObject = artwork.userId === session.user.id && artwork.artworkType === 'object'
  if (!isAdmin && !ownObject) return { error: 'Not authorized', status: 403 as const }
  return { userId: session.user.id, artwork }
}

/** The artwork's media, for the editor's manager. The public page reads the same
 *  rows through `getArtworkMedia`. */
export async function GET(request: NextRequest) {
  const artworkId = new URL(request.url).searchParams.get('artworkId')
  if (!artworkId) return NextResponse.json({ error: 'Missing artworkId' }, { status: 400 })
  const gate = await requireMediaAccess(artworkId)
  if ('error' in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  return NextResponse.json({ media: await getArtworkMedia(artworkId) })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { artworkId } = body
    if (typeof artworkId !== 'string' || !artworkId) {
      return NextResponse.json({ error: 'Missing artworkId' }, { status: 400 })
    }

    const gate = await requireMediaAccess(artworkId)
    if ('error' in gate) {
      return NextResponse.json({ error: gate.error }, { status: gate.status })
    }
    const { artwork } = gate

    if (body.type === 'request-upload') {
      // Presigning is cheap for us and expensive for the bucket. Bound it per
      // user so a runaway client cannot mint URLs indefinitely. Counted on the
      // presign only: an Object's 40 photos are one batch, not a runaway.
      const { success } = await rateLimit({
        name: 'artwork-media-upload',
        key: gate.userId,
        limit: 60,
        windowSeconds: 3600,
      })
      if (!success) {
        return NextResponse.json({ error: 'Too many uploads. Try again shortly.' }, { status: 429 })
      }

      const spec = ALLOWED[body.contentType as keyof typeof ALLOWED]
      if (!spec) {
        return NextResponse.json(
          { error: 'Invalid file type. Accepted: JPG, PNG, WebP, MP4, WebM.' },
          { status: 400 },
        )
      }
      const max = maxBytesFor(spec.kind, artwork.artworkType)
      if (typeof body.fileSize === 'number' && body.fileSize > max) {
        return NextResponse.json(
          { error: `File too large. Maximum is ${max / MB}MB.` },
          { status: 400 },
        )
      }

      // A ceiling far above real use, so a careless or compromised account
      // cannot fill the bucket. Counted here, before a URL is minted.
      // Per type (`mediaLimitsFor`): Objects take more videos than the other types.
      const limits = mediaLimitsFor(artwork.artworkType)
      const existing = await prisma.artworkMedia.findMany({
        where: { artworkId },
        select: { kind: true },
      })
      if (existing.length >= limits.maxItems) {
        return NextResponse.json(
          { error: `This artwork already holds the maximum of ${limits.maxItems} assets.` },
          { status: 400 },
        )
      }
      const sameKind = existing.filter((m) => m.kind === spec.kind).length
      if (spec.kind === 'video' && sameKind >= limits.maxVideos) {
        return NextResponse.json(
          { error: `At most ${limits.maxVideos} videos per artwork.` },
          { status: 400 },
        )
      }
      if (spec.kind === 'image' && sameKind >= limits.maxImages) {
        return NextResponse.json(
          { error: `At most ${limits.maxImages} photos per artwork.` },
          { status: 400 },
        )
      }

      const key = await buildArtworkSupplementaryKey(artwork.userId, artworkId, spec.ext)
      const presignedUrl = await getPresignedUploadUrl(key, body.contentType)
      return NextResponse.json({ presignedUrl, key, kind: spec.kind })
    }

    if (body.type === 'complete') {
      const { key, width, height, caption, role } = body
      if (!isSafeKey(key, artworkId)) {
        return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
      }

      const ext = key.split('.').pop() as string
      const kind = ext === 'mp4' || ext === 'webm' ? 'video' : 'image'
      const max = maxBytesFor(kind, artwork.artworkType)

      // The presigned PUT imposes no ceiling and the declared size was the
      // client's word, so check the real object before committing it.
      const size = await getR2ObjectSize(key)
      if (size !== null && size > max) {
        await deleteR2KeyDirect(key).catch(() => {})
        return NextResponse.json(
          { error: `File too large. Maximum is ${max / (1024 * 1024)}MB.` },
          { status: 400 },
        )
      }

      const r2PublicUrl = process.env.R2_PUBLIC_URL
      if (!r2PublicUrl) {
        console.error('[POST /api/artwork-media] R2_PUBLIC_URL is not configured')
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
      }
      // Rebuilt from the validated key. A client-supplied URL here would be an
      // SSRF primitive and a substitution vector both.
      const url = `${r2PublicUrl}/${key}`

      // What the client DECLARED is a string it chose; these objects sit in a
      // public bucket on a domain we own, so HTML uploaded as `image/png` would
      // be fetchable and executable from our own host. Only the header is read.
      const head = await fetch(url, { headers: { Range: 'bytes=0-63' } })
      const magic = head.ok ? Buffer.from(await head.arrayBuffer()) : Buffer.alloc(0)
      const valid = kind === 'video' ? isValidVideoType(magic) : isValidImageType(magic)
      if (!valid) {
        await deleteR2KeyDirect(key).catch(() => {})
        return NextResponse.json(
          { error: 'That file is not a valid image or video.' },
          { status: 400 },
        )
      }

      const last = await prisma.artworkMedia.findFirst({
        where: { artworkId },
        orderBy: { order: 'desc' },
        select: { order: true },
      })

      const created = await prisma.artworkMedia.create({
        data: {
          artworkId,
          kind,
          url,
          width: typeof width === 'number' ? width : null,
          height: typeof height === 'number' ? height : null,
          // Plain text only — never HTML.
          caption:
            typeof caption === 'string' && caption.trim() ? caption.trim().slice(0, 300) : null,
          // Objects only: the view's label (Front, Reel…).
          role: artwork.artworkType === 'object' && isObjectMediaRole(role) ? role : null,
          order: (last?.order ?? -1) + 1,
        },
        select: {
          id: true,
          kind: true,
          url: true,
          width: true,
          height: true,
          caption: true,
          role: true,
        },
      })

      return NextResponse.json(created)
    }

    return NextResponse.json({ error: 'Invalid request type' }, { status: 400 })
  } catch (error) {
    console.error('[POST /api/artwork-media] error:', error)
    captureError(error, { flow: 'upload', stage: 'artwork-media', level: 'error' })
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

/**
 * Remove one asset.
 *
 * Takes a ROW ID, never a key or a URL. The row is loaded, its artwork checked,
 * and the object deleted using the URL STORED IN THE ROW — so no string the
 * client chose ever reaches R2. The bucket has no versioning and a signed-in
 * user can otherwise delete any object in it; this endpoint must not widen that.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    if (typeof id !== 'string' || !id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const row = await prisma.artworkMedia.findUnique({
      where: { id },
      select: { id: true, url: true, artworkId: true },
    })
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const gate = await requireMediaAccess(row.artworkId)
    if ('error' in gate) {
      return NextResponse.json({ error: gate.error }, { status: gate.status })
    }

    await prisma.artworkMedia.delete({ where: { id: row.id } })

    // Row first, object second: an orphaned object is swept by
    // scripts/reconcile-r2.ts, whereas a row pointing at a deleted file renders
    // as a broken image on a public page.
    await deleteFromR2(row.url).catch((e) =>
      console.warn('[DELETE /api/artwork-media] object not removed:', e),
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[DELETE /api/artwork-media] error:', error)
    captureError(error, { flow: 'upload', stage: 'artwork-media-delete', level: 'error' })
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}

/**
 * Edit, never upload: one asset's label and caption (`{ id, role?, caption? }`),
 * or the order of all of an artwork's assets (`{ artworkId, order: ids[] }`,
 * every id once). The label is an Object's only (docs/objects).
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()

    if (Array.isArray(body.order)) {
      const { artworkId, order } = body as { artworkId: unknown; order: unknown[] }
      if (typeof artworkId !== 'string' || !artworkId) {
        return NextResponse.json({ error: 'Missing artworkId' }, { status: 400 })
      }
      const gate = await requireMediaAccess(artworkId)
      if ('error' in gate) {
        return NextResponse.json({ error: gate.error }, { status: gate.status })
      }
      const rows = await prisma.artworkMedia.findMany({
        where: { artworkId },
        select: { id: true },
      })
      const ids = new Set(rows.map((r) => r.id))
      const sameSet =
        order.length === ids.size &&
        new Set(order).size === order.length &&
        order.every((id) => typeof id === 'string' && ids.has(id))
      if (!sameSet) {
        return NextResponse.json(
          { error: 'The order must list every asset of this artwork once.' },
          { status: 400 },
        )
      }
      await prisma.$transaction(
        (order as string[]).map((id, index) =>
          prisma.artworkMedia.update({ where: { id }, data: { order: index } }),
        ),
      )
      return NextResponse.json({ media: await getArtworkMedia(artworkId) })
    }

    const { id, role, caption } = body
    if (typeof id !== 'string' || !id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }
    const row = await prisma.artworkMedia.findUnique({
      where: { id },
      select: { artworkId: true },
    })
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const gate = await requireMediaAccess(row.artworkId)
    if ('error' in gate) {
      return NextResponse.json({ error: gate.error }, { status: gate.status })
    }

    const data: { role?: string | null; caption?: string | null } = {}
    if (role !== undefined) {
      if (role !== null && (gate.artwork.artworkType !== 'object' || !isObjectMediaRole(role))) {
        return NextResponse.json({ error: 'Unknown label.' }, { status: 400 })
      }
      data.role = role
    }
    if (caption !== undefined) {
      if (caption !== null && typeof caption !== 'string') {
        return NextResponse.json({ error: 'The caption must be text.' }, { status: 400 })
      }
      // Plain text only — never HTML; escaped on render.
      const clean = caption === null ? '' : sanitizeLine(caption)
      if (clean.length > 300) {
        return NextResponse.json(
          { error: 'The caption is too long (300 at most).' },
          { status: 400 },
        )
      }
      data.caption = clean || null
    }

    const updated = await prisma.artworkMedia.update({
      where: { id },
      data,
      select: {
        id: true,
        kind: true,
        url: true,
        width: true,
        height: true,
        caption: true,
        role: true,
      },
    })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('[PATCH /api/artwork-media] error:', error)
    captureError(error, { flow: 'upload', stage: 'artwork-media-edit', level: 'error' })
    return NextResponse.json({ error: 'Could not save that change' }, { status: 500 })
  }
}
