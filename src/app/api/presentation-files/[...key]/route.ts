import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { requireAdminOrAbove } from '@/lib/authUtils'
import { bakeBackend } from '@/lib/bake/bakeStorage'
import { BAKE_CACHE_CONTROL } from '@/lib/bake/bakeUpload'
import {
  localPresentationPath,
  readLocalPresentationFile,
  writeLocalPresentationFile,
} from '@/lib/printPresentation/storage'

// Development-only file server for print presentations on the local backend
// (BAKE_STORAGE=local). A 404 everywhere else, so production never exposes it.

const MAX_BYTES = 16 * 1024 * 1024

const unavailable = () =>
  bakeBackend() !== 'local' || process.env.NEXT_PUBLIC_APP_ENV === 'production'

const notFound = () => NextResponse.json({ error: 'Not found' }, { status: 404 })

export async function GET(_req: NextRequest, context: { params: Promise<{ key: string[] }> }) {
  if (unavailable()) return notFound()
  const { key } = await context.params
  const filePath = localPresentationPath(key)
  if (!filePath) return notFound()
  const bytes = await readLocalPresentationFile(filePath)
  if (!bytes) return notFound()
  return new NextResponse(new Uint8Array(bytes), {
    headers: { 'Content-Type': 'image/webp', 'Cache-Control': BAKE_CACHE_CONTROL },
  })
}

export async function PUT(req: NextRequest, context: { params: Promise<{ key: string[] }> }) {
  if (unavailable()) return notFound()
  const { error } = await requireAdminOrAbove()
  if (error) return error
  try {
    const { key } = await context.params
    const filePath = localPresentationPath(key)
    if (!filePath) return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
    const bytes = Buffer.from(await req.arrayBuffer())
    if (bytes.length === 0 || bytes.length > MAX_BYTES) {
      return NextResponse.json({ error: 'Invalid file size' }, { status: 400 })
    }
    await writeLocalPresentationFile(filePath, bytes)
    return new NextResponse(null, { status: 200 })
  } catch (err) {
    console.error('[PUT /api/presentation-files] error:', err)
    return NextResponse.json({ error: 'Failed to store file' }, { status: 500 })
  }
}
