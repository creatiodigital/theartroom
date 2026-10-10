import { NextRequest, NextResponse, after } from 'next/server'
import crypto from 'crypto'

import prisma from '@/lib/prisma'
import { isEmail, MAX_LENGTHS, tooLong } from '@/lib/validation'
import { getClientIp } from '@/lib/getClientIp'
import { rateLimit } from '@/lib/rateLimit'
import { sendForgotPasswordEmail } from '@/lib/emails/forgotPassword'

// A gallery with a few dozen accounts sends a handful of these a week.
const FORGOT_PASSWORD_DAILY_CAP = 50

export async function POST(request: NextRequest) {
  try {
    // Rate limiting (durable, trusted x-real-ip not the spoofable first hop).
    const ip = getClientIp(request)
    const { success } = await rateLimit({
      name: 'forgot-password',
      key: ip,
      limit: 3,
      windowSeconds: 60,
    })
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 },
      )
    }

    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Bound the input before anything downstream reads it. The email regex
    // itself is linear and cheap; what this protects is everything after —
    // the Prisma lookup and the string being held in memory at all.
    if (tooLong(email, MAX_LENGTHS.email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Email format validation
    if (!isEmail(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Per-address cap on top of the per-IP one above, which a bot spread over
    // many IPs walks straight past — and then floods one artist's inbox with
    // reset emails. Checked BEFORE the lookup, for known and unknown addresses
    // alike, so it cannot become a way to tell which emails have accounts. Over
    // the cap the caller gets the same silent success as an unknown address.
    const perAddress = await rateLimit({
      name: 'forgot-password-email',
      key: email.trim().toLowerCase(),
      limit: 3,
      windowSeconds: 60 * 60,
    })
    if (!perAddress.success) {
      return NextResponse.json({ success: true })
    }

    // Find user by email (don't reveal if email exists or not for security)
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    // For security, always return success even if user not found
    if (!user) {
      // Silent return — don't reveal whether email exists
      return NextResponse.json({ success: true })
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now

    // Store token in database (using magicLink fields)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        magicLinkToken: resetToken,
        magicLinkExpiry: tokenExpiry,
      },
    })

    // Build reset URL
    const baseUrl = process.env.NEXTAUTH_URL || 'https://theartroom.gallery'
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`

    // Send the reset email AFTER the response. Awaiting the provider
    // round-trip only for existing accounts makes the response measurably
    // slower for real users than for unknown emails — a timing oracle for
    // account existence. `after()` defers the send past the response (so the
    // client-observed latency matches the unknown-email branch) while the
    // platform keeps the function alive to actually deliver it — unlike a bare
    // fire-and-forget, which a serverless runtime may freeze before it sends.
    after(async () => {
      try {
        // Site-wide ceiling on reset emails actually sent — the backstop when
        // many IPs AND many addresses are in play. Counted here, after the
        // response, so it adds no account-dependent latency.
        const daily = await rateLimit({
          name: 'forgot-password-daily',
          key: 'global',
          limit: FORGOT_PASSWORD_DAILY_CAP,
          windowSeconds: 24 * 60 * 60,
        })
        if (!daily.success) {
          console.error('[forgot-password] daily cap reached, reset email not sent')
          return
        }
        await sendForgotPasswordEmail({ to: email, name: user.name, resetUrl })
      } catch (err) {
        console.error('Error sending forgot-password email:', err)
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error processing forgot password:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
