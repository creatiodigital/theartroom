import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'

import type { Prisma } from '@/generated/prisma'
import { UserType as UserTypeEnum } from '@/generated/prisma'
import { auth } from '@/auth'
import {
  requireAdminOrAbove,
  requireSuperAdmin,
  canModifyUser,
  isAdminOrAbove,
  isSuperAdmin,
} from '@/lib/authUtils'
import prisma from '@/lib/prisma'
import { deleteFromR2 } from '@/lib/r2'
import { isEmail } from '@/lib/validation'
import { sanitizeLine } from '@/utils/sanitizeLine'

type Body = {
  name?: string
  lastName?: string
  biography?: string
  handler?: string
  userType?: string
  email?: string
  isFeatured?: boolean
  published?: boolean
}

type UserTypeValue = (typeof UserTypeEnum)[keyof typeof UserTypeEnum]

const toUserType = (val: unknown): UserTypeValue | undefined => {
  if (typeof val !== 'string') return undefined
  return (Object.values(UserTypeEnum) as string[]).includes(val)
    ? (val as UserTypeValue)
    : undefined
}

// Admin roles that require superAdmin to assign
const PROTECTED_ROLES: UserTypeValue[] = ['admin', 'superAdmin']

/* ------------------------ GET ------------------------ */
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    // Self-or-admin: this returns email/role/signature, which must not be
    // enumerable by id. "Self" includes the impersonated identity — the
    // dashboard profile page fetches by effective user id.
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const isSelf = id === session.user.id || id === session.impersonating?.id
    if (!isSelf && !isAdminOrAbove(session.user.userType)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        lastName: true,
        email: true,
        handler: true,
        biography: true,
        userType: true,
        isFeatured: true,
        published: true,
        profileImageUrl: true,
        signatureUrl: true,
      },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    return NextResponse.json(user)
  } catch (error) {
    console.error('[GET /api/users/[id]] error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

/* ------------------------ PUT ------------------------ */
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    // Require admin or superAdmin
    const { session, error: authError } = await requireAdminOrAbove()
    if (authError) return authError

    const { id } = await context.params
    const body = (await request.json()) as Body

    // Get target user to check their role
    const targetUser = await prisma.user.findUnique({ where: { id } })
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if actor can modify target user based on role hierarchy
    if (!canModifyUser(session.user.userType, targetUser.userType, targetUser.id === session.user.id)) {
      return NextResponse.json({ error: 'Forbidden - Cannot modify this user' }, { status: 403 })
    }

    const userTypeEnum = toUserType(body.userType)
    if (body.userType && !userTypeEnum) {
      return NextResponse.json({ error: 'Invalid userType' }, { status: 400 })
    }

    // Only superAdmin can assign admin/superAdmin roles
    if (userTypeEnum && PROTECTED_ROLES.includes(userTypeEnum)) {
      if (!isSuperAdmin(session.user.userType)) {
        return NextResponse.json(
          { error: 'Forbidden - Only Super Admin can assign admin roles' },
          { status: 403 },
        )
      }
    }

    // Sanitize single-line text fields. Biography is rich-text HTML
    // (TipTap) — left untouched here, DOMPurify cleans it at render
    // time. Length caps on the sanitized values reject oversized
    // payloads that smuggled control chars to pad their byte count.
    const data: Prisma.UserUpdateInput = {}
    if (body.name !== undefined) {
      const v = sanitizeLine(String(body.name))
      if (v.length > 100) {
        return NextResponse.json({ error: 'Name too long.' }, { status: 400 })
      }
      data.name = v
    }
    if (body.lastName !== undefined) {
      const v = sanitizeLine(String(body.lastName))
      if (v.length > 100) {
        return NextResponse.json({ error: 'Last name too long.' }, { status: 400 })
      }
      data.lastName = v
    }
    if (body.biography !== undefined) data.biography = body.biography
    if (body.handler !== undefined) {
      const v = sanitizeLine(String(body.handler))
      if (v.length > 60) {
        return NextResponse.json({ error: 'Handler too long.' }, { status: 400 })
      }
      data.handler = v
    }
    if (body.email !== undefined) {
      const v = sanitizeLine(String(body.email))
      if (v.length > 200) {
        return NextResponse.json({ error: 'Email too long.' }, { status: 400 })
      }
      // Required + format-checked when supplied — mirrors the profile form's
      // client rule (shared `isEmail`) so the two never drift. Admin toggles
      // that don't send `email` are unaffected.
      if (!isEmail(v)) {
        return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
      }
      data.email = v
    }
    if (body.isFeatured !== undefined) data.isFeatured = body.isFeatured
    if (body.published !== undefined) data.published = body.published
    if (userTypeEnum !== undefined) data.userType = { set: userTypeEnum }

    // Explicit select, mirroring the GET above. Without it this returned the
    // whole row — bcrypt hash, plaintext magicLinkToken, plaintext loginCode,
    // stripeAccountId — to the caller on EVERY save, including the admin list's
    // "Set as Featured" toggle. `api/artists/route.ts` states the rule outright:
    // never return the full row, it carries the password hash and the
    // login/reset secret columns.
    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        lastName: true,
        email: true,
        handler: true,
        biography: true,
        userType: true,
        isFeatured: true,
        published: true,
        profileImageUrl: true,
        signatureUrl: true,
      },
    })

    // Cascade: unpublishing an artist also unpublishes all their exhibitions
    if (body.published === false) {
      await prisma.exhibition.updateMany({
        where: { userId: id, published: true },
        data: { published: false },
      })
    }

    revalidatePath('/')

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[PUT /api/users/[id]] error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

/* ------------------------ DELETE ------------------------ */
export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    // Only superAdmin can delete users
    const { session, error: authError } = await requireSuperAdmin()
    if (authError) return authError

    const { id } = await context.params

    // Prevent self-deletion
    if (id === session.user.id) {
      return NextResponse.json({ error: 'Forbidden - Cannot delete yourself' }, { status: 403 })
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: {
        profileImageUrl: true,
        signatureUrl: true,
        _count: { select: { artworks: true, exhibitions: true } },
      },
    })
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Refused while the user still has artworks or exhibitions. The cascade
    // would take their rows but none of their files, and an artwork with
    // orders can't go at all: each is deleted on its own first, which cleans
    // its files and keeps a sold work.
    const { artworks, exhibitions } = targetUser._count
    if (artworks > 0 || exhibitions > 0) {
      const count = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`
      const held = [
        artworks > 0 ? count(artworks, 'artwork') : null,
        exhibitions > 0 ? count(exhibitions, 'exhibition') : null,
      ]
        .filter(Boolean)
        .join(' and ')
      return NextResponse.json(
        {
          error: `This user still has ${held}. Delete ${artworks + exhibitions === 1 ? 'it' : 'them'} first, then the user.`,
        },
        { status: 409 },
      )
    }

    // The row first, files after (as an artwork delete): a refused delete
    // never loses a file.
    try {
      await prisma.user.delete({ where: { id } })
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2003') {
        return NextResponse.json(
          { error: 'This user has orders, so they cannot be deleted.' },
          { status: 409 },
        )
      }
      throw error
    }

    // Best-effort: an orphaned file is a cost, never a reason to report the
    // completed delete as failed.
    for (const url of [targetUser.profileImageUrl, targetUser.signatureUrl]) {
      if (!url) continue
      try {
        await deleteFromR2(url)
      } catch (error) {
        console.warn('[DELETE /api/users/[id]] failed to delete a file:', error)
      }
    }

    revalidatePath('/')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/users/[id]] error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
