import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import sharp from 'sharp'

import { requireOwnership } from '@/lib/authUtils'
import prisma from '@/lib/prisma'
import { buildSignatureImageKey, deleteFromR2, uploadToR2 } from '@/lib/r2'

// Kept modest — a signature is just a line drawing, no need for a heavy file.
const MAX_FILE_SIZE = 3 * 1024 * 1024 // 3MB

// Signature has to be legible at the size it ends up on the certificate
// (~56mm wide at 300 DPI ≈ 660px), but we want some headroom for hi-DPI
// reprints. 600×200 keeps the bar reasonable without demanding a scanner.
const MIN_WIDTH = 600
const MIN_HEIGHT = 200

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { error: authError } = await requireOwnership(id)
    if (authError) return authError

    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const formData = await request.formData()
    const file = formData.get('image') as File | null
    if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 3MB.' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // PNG-only so we keep the transparent background that makes the
    // signature look like an actual signature on the certificate.
    const meta = await sharp(buffer).metadata()
    if (meta.format !== 'png') {
      return NextResponse.json(
        { error: 'Signature must be a transparent PNG. Please export your signature as PNG.' },
        { status: 400 },
      )
    }

    const width = meta.width ?? 0
    const height = meta.height ?? 0
    if (width < MIN_WIDTH || height < MIN_HEIGHT) {
      return NextResponse.json(
        {
          error: `Image is too small (${width}×${height}). Minimum is ${MIN_WIDTH}×${MIN_HEIGHT} pixels for a crisp signature on the certificate.`,
        },
        { status: 400 },
      )
    }

    // Ensure an alpha channel is present. If the user uploaded a PNG
    // with a solid white background, we flag it — a signature with a
    // white box around it looks amateur on the cert.
    if (!meta.hasAlpha) {
      return NextResponse.json(
        {
          error:
            'The uploaded PNG has no transparent background. Please export the signature on a transparent background.',
        },
        { status: 400 },
      )
    }

    // Delete the prior signature if we had one, so R2 doesn't accumulate dead files.
    if (user.signatureUrl) {
      try {
        await deleteFromR2(user.signatureUrl)
      } catch (err) {
        console.warn('[POST /api/users/[id]/signature] failed to delete old signature:', err)
      }
    }

    const key = await buildSignatureImageKey(id)
    const url = await uploadToR2(key, buffer, 'image/png')

    await prisma.user.update({ where: { id }, data: { signatureUrl: url } })

    return NextResponse.json({ url })
  } catch (err) {
    console.error('[POST /api/users/[id]/signature] error:', err)
    return NextResponse.json({ error: 'Failed to upload signature' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { error: authError } = await requireOwnership(id)
    if (authError) return authError

    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    if (user.signatureUrl) {
      try {
        await deleteFromR2(user.signatureUrl)
      } catch (err) {
        console.warn('[DELETE /api/users/[id]/signature] failed to delete blob:', err)
      }
    }

    await prisma.user.update({ where: { id }, data: { signatureUrl: null } })
    return NextResponse.json({ message: 'Signature removed' })
  } catch (err) {
    console.error('[DELETE /api/users/[id]/signature] error:', err)
    return NextResponse.json({ error: 'Failed to remove signature' }, { status: 500 })
  }
}
