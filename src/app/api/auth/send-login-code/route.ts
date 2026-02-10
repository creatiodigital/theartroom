import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { Resend } from 'resend'

import prisma from '@/lib/prisma'

const resend = new Resend(process.env.RESEND_API_KEY)

// Generate a random 6-digit code
function generateLoginCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user || !user.password) {
      // Return generic error to prevent email enumeration
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password)
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // If user must change password (provisional login), skip OTP
    if (user.mustChangePassword) {
      return NextResponse.json({ success: true, mustChangePassword: true })
    }

    // Generate 6-digit code with 10-minute expiry
    const loginCode = generateLoginCode()
    const loginCodeExpiry = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    // Store code in database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginCode,
        loginCodeExpiry,
      },
    })

    // Send code via email
    const fromEmail = process.env.FROM_EMAIL || 'contact@theartroom.gallery'

    await resend.emails.send({
      from: `The Art Room <${fromEmail}>`,
      to: email,
      subject: 'Your login verification code',
      html: `
        <div style="font-family: Lato, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="font-size: 24px; margin-bottom: 24px;">Verification Code</h2>
          
          <p>Your login verification code is:</p>
          
          <div style="text-align: center; margin: 32px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; font-family: monospace;">
              ${loginCode}
            </span>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            This code will expire in 10 minutes.
          </p>
          
          <p style="color: #666; font-size: 14px;">
            If you didn't request this code, please ignore this email.
          </p>
          
          <hr style="margin: 32px 0; border: none; border-top: 1px solid #eee;" />
          
          <p style="color: #666; font-size: 12px;">
            The Art Room - theartroom.gallery
          </p>
        </div>
      `,
    })

    console.log('Login code sent to:', email)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error sending login code:', error)
    return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 })
  }
}
