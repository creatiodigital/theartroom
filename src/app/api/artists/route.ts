import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'

import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET all artists
export async function GET() {
  try {
    const artists = await prisma.user.findMany({
      where: { userType: 'artist' },
      select: {
        id: true,
        name: true,
        lastName: true,
        handler: true,
        biography: true,
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(artists)
  } catch (error) {
    console.error('[GET /api/artists] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST create new artist
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, lastName, handler, email, biography, password, userType } = body

    // Validate required fields
    if (!name || !lastName || !handler || !email) {
      return NextResponse.json(
        { error: 'Name, lastName, handler, and email are required' },
        { status: 400 }
      )
    }

    // Hash password if provided
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null

    const artist = await prisma.user.create({
      data: {
        name,
        lastName,
        handler,
        email,
        biography: biography || '',
        password: hashedPassword,
        userType: userType || 'artist',
      },
    })

    return NextResponse.json(artist, { status: 201 })
  } catch (error: unknown) {
    console.error('[POST /api/artists] error:', error)
    
    // Handle unique constraint errors
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Handler or email already exists' },
        { status: 409 }
      )
    }
    
    return NextResponse.json({ error: 'Failed to create artist' }, { status: 500 })
  }
}
