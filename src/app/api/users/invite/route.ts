import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

import { requireSuperAdmin } from '@/lib/authUtils'
import prisma from '@/lib/prisma'
import { generateProvisionalPassword } from '@/utils/password'
import { sendArtistInviteEmail, sendArtistSetPasswordEmail } from '@/lib/emails/artistInvite'
import { inviteKind, SET_PASSWORD_LINK_HOURS } from '@/lib/invite'

export async function POST(request: NextRequest) {
  try {
    // Only superAdmin can invite users
    const { error: authError } = await requireSuperAdmin()
    if (authError) return authError

    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!user.email) {
      return NextResponse.json({ error: 'User does not have an email address' }, { status: 400 })
    }

    // Build login URL
    const baseUrl = process.env.NEXTAUTH_URL || 'https://theartroom.gallery'
    const loginUrl = `${baseUrl}/dashboard/login`

    // Step 21 (questions.md Q37): someone who already signs in with their own password keeps it,
    // and gets a link to set a new one (the reset-password token and page). Nothing else changes.
    if (inviteKind(user) === 'set-password-link') {
      const token = crypto.randomBytes(32).toString('hex')
      await prisma.user.update({
        where: { id: userId },
        data: {
          magicLinkToken: token,
          magicLinkExpiry: new Date(Date.now() + SET_PASSWORD_LINK_HOURS * 60 * 60 * 1000),
        },
      })
      await sendArtistSetPasswordEmail({
        to: user.email,
        name: user.name,
        setPasswordUrl: `${baseUrl}/reset-password?token=${token}`,
        loginUrl,
        hours: SET_PASSWORD_LINK_HOURS,
      })
      return NextResponse.json({ success: true })
    }

    // Everyone else: a fresh provisional password, as every invite did before
    const provisionalPassword = generateProvisionalPassword()
    const hashedPassword = await bcrypt.hash(provisionalPassword, 10)
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword, mustChangePassword: true },
    })

    // Send invite email
    await sendArtistInviteEmail({
      to: user.email,
      name: user.name,
      email: user.email,
      tempPassword: provisionalPassword,
      loginUrl,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error sending invite:', error)
    return NextResponse.json({ error: 'Failed to send invite' }, { status: 500 })
  }
}
