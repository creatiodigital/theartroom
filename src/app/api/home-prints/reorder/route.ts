import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

import { requireSuperAdmin } from '@/lib/authUtils'
import { reorderByIndex } from '@/lib/reorderByIndex'

/** The twin of /api/selected-prints/reorder: each row's `order` becomes its index, in one statement. */
export async function POST(request: Request) {
  const { error } = await requireSuperAdmin()
  if (error) return error

  const body = (await request.json()) as { ids?: unknown }
  const ids = Array.isArray(body.ids) ? body.ids.filter((i) => typeof i === 'string') : []
  if (ids.length === 0) {
    return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 })
  }

  await reorderByIndex('HomePrint', ids as string[])

  revalidatePath('/')
  return NextResponse.json({ success: true })
}
