import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { auth } from '@/auth'
import { isSuperAdmin } from '@/lib/authUtils'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)
    const featured = searchParams.get('featured')

    // Base filter
    const where: Record<string, unknown> = featured === 'true' ? { isFeatured: true } : {}

    // If user is admin (not superAdmin), hide other admins and superAdmins
    if (session?.user && !isSuperAdmin(session.user.userType)) {
      where.userType = { notIn: ['admin', 'superAdmin'] }
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error('[GET /api/users] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

