import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

import { requireSuperAdmin } from '@/lib/authUtils'
import prisma from '@/lib/prisma'

type RouteParams = { params: Promise<{ id: string }> }

/** Removes one Home page prints entry (the twin of /api/selected-prints/[id]). */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { error } = await requireSuperAdmin()
  if (error) return error

  const { id } = await params
  await prisma.homePrint.deleteMany({ where: { id } })

  revalidatePath('/')
  return NextResponse.json({ success: true })
}
