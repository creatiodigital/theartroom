import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET all slides
export async function GET() {
  try {
    const slides = await prisma.slide.findMany({
      orderBy: { order: 'asc' },
    })
    return NextResponse.json(slides)
  } catch (error) {
    console.error('Error fetching slides:', error)
    return NextResponse.json({ error: 'Failed to fetch slides' }, { status: 500 })
  }
}

// POST create new slide
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { imageUrl, title, subtitle, meta, exhibitionUrl, order, isActive } = body

    // Get max order if not provided
    let slideOrder = order
    if (slideOrder === undefined) {
      const maxOrder = await prisma.slide.aggregate({
        _max: { order: true },
      })
      slideOrder = (maxOrder._max.order ?? -1) + 1
    }

    const slide = await prisma.slide.create({
      data: {
        imageUrl,
        title,
        subtitle,
        meta,
        exhibitionUrl,
        order: slideOrder,
        isActive: isActive ?? true,
      },
    })

    return NextResponse.json(slide, { status: 201 })
  } catch (error) {
    console.error('Error creating slide:', error)
    return NextResponse.json({ error: 'Failed to create slide' }, { status: 500 })
  }
}
