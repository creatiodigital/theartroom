import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

import { requireSuperAdmin } from '@/lib/authUtils'
import prisma from '@/lib/prisma'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    // Only superAdmin can invite users
    const { error: authError } = await requireSuperAdmin()
    if (authError) return authError

    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (!user.email) {
      return NextResponse.json(
        { error: 'User does not have an email address' },
        { status: 400 }
      )
    }

    // Build login URL
    const baseUrl = process.env.NEXTAUTH_URL || 'https://theartroom.gallery'
    const loginUrl = `${baseUrl}/${user.handler}/login`

    // Send invite email
    const fromEmail = process.env.FROM_EMAIL || 'contact@theartroom.gallery'

    await resend.emails.send({
      from: `The Art Room <${fromEmail}>`,
      to: user.email,
      subject: 'You\'ve been invited to The Art Room',
      html: `
        <div style="font-family: Lato, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="font-size: 24px; margin-bottom: 24px;">Welcome to The Art Room!</h2>
          
          <p>Hi ${user.name},</p>
          
          <p>You've been invited to join The Art Room as an artist. Your account is ready and waiting for you.</p>
          
          <h3 style="font-size: 18px; margin-top: 24px;">Your Login Details:</h3>
          <ul style="line-height: 1.8;">
            <li><strong>Email:</strong> ${user.email}</li>
            <li><strong>Password:</strong> You'll need to set one using "Forgot Password" on your first visit</li>
          </ul>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${loginUrl}" style="display: inline-block; padding: 12px 32px; background-color: #000; color: #fff; text-decoration: none; font-size: 16px;">
              Go to Your Login Page
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            Your personal login page: <a href="${loginUrl}">${loginUrl}</a>
          </p>
          
          <hr style="margin: 32px 0; border: none; border-top: 1px solid #eee;" />
          
          <p style="color: #666; font-size: 12px;">
            If you have any questions, please contact our support team.
          </p>
        </div>
      `,
    })

    console.log('Invite email sent to:', user.email)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error sending invite:', error)
    return NextResponse.json(
      { error: 'Failed to send invite' },
      { status: 500 }
    )
  }
}
