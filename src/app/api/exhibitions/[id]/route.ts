import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import prisma from '@/lib/prisma'

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    // params is now a Promise — must be awaited
    const { id } = await context.params

    await prisma.exhibition.delete({ where: { id } })

    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error('[DELETE /api/exhibitions/[id]] error:', error)
    return NextResponse.json({ error: 'Failed to delete exhibition' }, { status: 500 })
  }
}
