import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { validatePassword } from '@/utils/password'

export async function POST(request: NextRequest) {
  try {
    // Require authenticated session
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { newPassword } = body

    if (!newPassword) {
      return NextResponse.json({ error: 'New password is required' }, { status: 400 })
    }

    // Validate password requirements
    const validation = validatePassword(newPassword)
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Password must have ${validation.errors.join(', ')}` },
        { status: 400 },
      )
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Update password and clear mustChangePassword flag
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
      },
    })

    console.log('Password changed for user:', session.user.email)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error changing password:', error)
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 })
  }
}
