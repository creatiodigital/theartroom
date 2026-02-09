import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { getEffectiveUserId } from '@/lib/authUtils'
import prisma from '@/lib/prisma'

// DELETE a preset
export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { userId, error: authError } = await getEffectiveUserId()
    if (authError) return authError

    const { id } = await context.params

    // Verify ownership
    const preset = await prisma.artworkPreset.findUnique({
      where: { id },
    })

    if (!preset) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 })
    }

    if (preset.userId !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    await prisma.artworkPreset.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/presets/[id]] error:', error)
    return NextResponse.json({ error: 'Failed to delete preset' }, { status: 500 })
  }
}
