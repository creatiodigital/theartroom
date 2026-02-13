import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY)

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
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown'

    // Check rate limit
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 },
      )
    }

    const body = await request.json()

    const { firstName, lastName, email, phone, message, artworkId, artworkTitle, artworkArtist } =
      body

    // Validate required fields
    if (!firstName || !lastName || !email || !phone || !message) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Get environment variables
    const fromEmail = process.env.FROM_EMAIL || 'contact@theartroom.gallery'
    const inquiryRecipientsEnv = process.env.INQUIRY_EMAIL_TO || 'contact@theartroom.gallery'
    // Support comma-separated emails for multiple recipients
    const inquiryRecipients = inquiryRecipientsEnv.split(',').map((e) => e.trim())

    // Send inquiry notification to admin
    await resend.emails.send({
      from: `The Art Room <${fromEmail}>`,
      to: inquiryRecipients,
      replyTo: email,
      subject: `New Inquiry: ${artworkTitle} by ${artworkArtist}`,
      html: `
        <div style="font-family: Lato, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="font-size: 24px; margin-bottom: 24px;">New Artwork Inquiry</h2>
          
          <div style="background-color: #f9f9f9; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px 0;"><strong>Artwork:</strong> ${artworkTitle}</p>
            <p style="margin: 0 0 8px 0;"><strong>Artist:</strong> ${artworkArtist}</p>
            <p style="margin: 0;"><strong>Artwork ID:</strong> ${artworkId}</p>
          </div>
          
          <h3 style="font-size: 18px; margin-bottom: 16px;">Contact Information</h3>
          <p style="margin: 0 0 8px 0;"><strong>Name:</strong> ${firstName} ${lastName}</p>
          <p style="margin: 0 0 8px 0;"><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          <p style="margin: 0 0 24px 0;"><strong>Phone:</strong> ${phone}</p>
          
          <h3 style="font-size: 18px; margin-bottom: 16px;">Message</h3>
          <div style="background-color: #f9f9f9; padding: 20px; white-space: pre-wrap;">${message}</div>
          
          <p style="margin-top: 32px; color: #666; font-size: 12px;">
            This inquiry was submitted via The Art Room website.
          </p>
        </div>
      `,
    })

    // Send confirmation to the user
    await resend.emails.send({
      from: `The Art Room <${fromEmail}>`,
      to: email,
      subject: `We received your inquiry about "${artworkTitle}"`,
      html: `
        <div style="font-family: Lato, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="font-size: 24px; margin-bottom: 24px;">Thank you for your inquiry</h2>
          
          <p>Dear ${firstName},</p>
          
          <p>We have received your inquiry about <strong>${artworkTitle}</strong> by ${artworkArtist}.</p>
          
          <p>Our team will review your message and get back to you as soon as possible.</p>
          
          <div style="background-color: #f9f9f9; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 8px 0;"><strong>Your message:</strong></p>
            <p style="margin: 0; white-space: pre-wrap;">${message}</p>
          </div>
          
          <p>Best regards,<br>The Art Room Team</p>
          
          <hr style="margin: 32px 0; border: none; border-top: 1px solid #eee;" />
          
          <p style="color: #666; font-size: 12px;">
            This is an automated confirmation. Please do not reply to this email.
          </p>
        </div>
      `,
    })

    console.log('Inquiry sent successfully:', {
      artworkId,
      artworkTitle,
      artworkArtist,
      userEmail: email,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error processing inquiry:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
