import { NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/authUtils'
import prisma from '@/lib/prisma'

type RouteParams = { params: Promise<{ slug: string }> }

// GET page content by slug (public)
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params
    let page = await prisma.pageContent.findUnique({
      where: { slug },
    })

    // Create page with default content if it doesn't exist
    if (!page) {
      page = await prisma.pageContent.create({
        data: {
          slug,
          title: formatSlugToTitle(slug),
          content: '<p>Content coming soon...</p>',
        },
      })
    }

    return NextResponse.json(page)
  } catch (error) {
    console.error('Error fetching page:', error)
    return NextResponse.json({ error: 'Failed to fetch page' }, { status: 500 })
  }
}

// PUT update page content (admin only)
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    // Require admin role
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const { slug } = await params
    const body = await request.json()
    const { title, content } = body

    const page = await prisma.pageContent.upsert({
      where: { slug },
      update: { title, content },
      create: { slug, title, content },
    })

    return NextResponse.json(page)
  } catch (error) {
    console.error('Error updating page:', error)
    return NextResponse.json({ error: 'Failed to update page' }, { status: 500 })
  }
}

function formatSlugToTitle(slug: string): string {
  const titles: Record<string, string> = {
    about: 'About Us',
    terms: 'Terms and Conditions',
    privacy: 'Privacy Policy',
    accessibility: 'Accessibility Policy',
  }
  return titles[slug] || slug.charAt(0).toUpperCase() + slug.slice(1)
}
