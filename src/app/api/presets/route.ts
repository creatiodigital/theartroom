import { NextResponse } from 'next/server'

import { getEffectiveUserId } from '@/lib/authUtils'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET all presets for authenticated user
export async function GET() {
  try {
    const { userId, error: authError } = await getEffectiveUserId()
    if (authError) return authError

    const presets = await prisma.artworkPreset.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(presets)
  } catch (error) {
    console.error('[GET /api/presets] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST create a new preset
export async function POST(request: Request) {
  try {
    const { userId, error: authError } = await getEffectiveUserId()
    if (authError) return authError

    const body = await request.json()

    const preset = await prisma.artworkPreset.create({
      data: {
        userId,
        name: body.name,
        presetType: body.presetType || 'image',
        // Dimensions
        width2d: Number(body.width2d) || 100,
        height2d: Number(body.height2d) || 100,
        // Frame
        showFrame: body.showFrame ?? false,
        frameColor: body.frameColor ?? '#000000',
        frameSize: Number(body.frameSize) || 5,
        frameThickness: Number(body.frameThickness) || 0.5,
        // Passepartout
        showPassepartout: body.showPassepartout ?? false,
        passepartoutColor: body.passepartoutColor ?? '#ffffff',
        passepartoutSize: Number(body.passepartoutSize) || 10,
        passepartoutThickness: Number(body.passepartoutThickness) || 0.3,
        // Support
        showSupport: body.showSupport ?? false,
        supportThickness: Number(body.supportThickness) || 2.0,
        supportColor: body.supportColor ?? '#ffffff',
        // Shadow
        hideShadow: body.hideShadow ?? false,
        // Text styling
        fontFamily: body.fontFamily ?? 'Montserrat',
        fontSize: Number(body.fontSize) || 16,
        fontWeight: body.fontWeight ?? '400',
        letterSpacing: Number(body.letterSpacing ?? 0),
        lineHeight: Number(body.lineHeight) || 1.4,
        textColor: body.textColor ?? '#000000',
        textBackgroundColor: body.textBackgroundColor ?? null,
        textAlign: body.textAlign ?? 'left',
        textVerticalAlign: body.textVerticalAlign ?? 'top',
        textPadding: Number(body.textPadding) || 12,
      },
    })

    return NextResponse.json(preset, { status: 201 })
  } catch (error) {
    console.error('[POST /api/presets] error:', error)
    return NextResponse.json({ error: 'Failed to create preset' }, { status: 500 })
  }
}
