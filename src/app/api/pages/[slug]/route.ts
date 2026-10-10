import { revalidatePath, revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/authUtils'
import { PAGE_ROUTE_BY_SLUG } from '@/lib/cms/pageRoutes'
import prisma from '@/lib/prisma'

type RouteParams = { params: Promise<{ slug: string }> }

// GET page content by slug (public) — read fresh so the admin editor always
// reflects the latest save.
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

    // The public pages read through getStaticPageContent, which caches each
    // page for 24h under `page-${slug}`. This line used to say there was no
    // cache to bust — written before that cache existed — so an admin edit sat
    // invisible on the live site for up to a day. `expire: 0` drops the entry
    // outright; a named profile ('default'/'max') is stale-while-revalidate and
    // would serve the old text once more after the save.
    revalidateTag(`page-${slug}`, { expire: 0 })
    const route = PAGE_ROUTE_BY_SLUG[slug]
    if (route) revalidatePath(route)

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
    'sale-terms': 'Online Terms of Sale',
    prints: 'Prints',
  }
  return titles[slug] || slug.charAt(0).toUpperCase() + slug.slice(1)
}
