import { NextRequest, NextResponse } from 'next/server'

// Rate limiting - simple in-memory store (resets on redeploy)
const rateLimitStore = new Map<string, { count: number; timestamp: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX = 3 // Max 3 requests per minute per IP

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const record = rateLimitStore.get(ip)

  if (!record || now - record.timestamp > RATE_LIMIT_WINDOW) {
    rateLimitStore.set(ip, { count: 1, timestamp: now })
    return false
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return true
  }

  record.count++
  return false
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'unknown'

    // Check rate limit
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    
    const { 
      firstName, 
      lastName, 
      email, 
      phone, 
      message, 
      artworkId, 
      artworkTitle, 
      artworkArtist 
    } = body

    // Validate required fields
    if (!firstName || !lastName || !email || !phone || !message) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // TODO: Implement Resend email sending
    // When ready, add:
    // 1. Install resend: pnpm add resend
    // 2. Add RESEND_API_KEY to .env
    // 3. Add INQUIRY_EMAIL (recipient) to .env
    // 4. Add FROM_EMAIL (sender) to .env
    //
    // Example implementation:
    // import { Resend } from 'resend'
    // const resend = new Resend(process.env.RESEND_API_KEY)
    //
    // // Send inquiry to gallery
    // await resend.emails.send({
    //   from: process.env.FROM_EMAIL,
    //   to: process.env.INQUIRY_EMAIL,
    //   subject: `Artwork Inquiry: ${artworkTitle} by ${artworkArtist}`,
    //   html: `...email template...`
    // })
    //
    // // Send confirmation to user
    // await resend.emails.send({
    //   from: process.env.FROM_EMAIL,
    //   to: email,
    //   subject: 'We received your inquiry',
    //   html: `...confirmation template...`
    // })

    console.log('Inquiry received (email not yet configured):', {
      firstName,
      lastName,
      email,
      phone,
      message,
      artworkId,
      artworkTitle,
      artworkArtist,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error processing inquiry:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
