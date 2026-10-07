import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

test.use({ storageState: 'e2e/.auth/admin.json' })

/**
 * A homepage slide can carry an optional portrait image for phones + tablets
 * (below the 1024px desktop breakpoint). Without one, the desktop image is used
 * everywhere. The image URLs point at a real app asset so nothing 404s and no
 * R2 object is created; the rows are deleted in `finally`.
 */
const DESKTOP_SRC = '/assets/person.png?e2e=slide-desktop'
const MOBILE_SRC = '/assets/person.png?e2e=slide-mobile'

async function createSlide(tag: string, mobileImageUrl: string | null) {
  return prisma.slide.create({
    data: {
      imageUrl: DESKTOP_SRC,
      mobileImageUrl,
      title: `E2E Slide ${tag}`,
      subtitle: 'E2E',
      meta: '',
      exhibitionUrl: `/e2e-slide-${tag}-${Date.now()}`,
      order: 9999,
      isActive: true,
    },
  })
}

test('the homepage serves the mobile image below desktop, and falls back without one', async ({
  page,
}) => {
  const withMobile = await createSlide('with', MOBILE_SRC)
  const withoutMobile = await createSlide('without', null)
  try {
    await page.goto('/')

    const mobileSlide = page.locator(`a[href="${withMobile.exhibitionUrl}"]`)
    const source = mobileSlide.locator('picture source')
    await expect(source).toHaveAttribute('srcset', MOBILE_SRC)
    await expect(source).toHaveAttribute('media', '(max-width: 1023.98px)')
    await expect(mobileSlide.locator('picture img')).toHaveAttribute('src', DESKTOP_SRC)

    const plainSlide = page.locator(`a[href="${withoutMobile.exhibitionUrl}"]`)
    await expect(plainSlide.locator('picture source'), 'no mobile image → no source').toHaveCount(0)
    await expect(plainSlide.locator('picture img')).toHaveAttribute('src', DESKTOP_SRC)
  } finally {
    await prisma.slide.deleteMany({ where: { id: { in: [withMobile.id, withoutMobile.id] } } })
  }
})

test('saving a slide keeps its mobile image; removing it clears only the mobile one', async ({
  page,
}) => {
  const slide = await createSlide('remove', MOBILE_SRC)
  try {
    // The edit form PUTs the whole slide; the mobile image is owned by the
    // image route, so a plain save must not wipe it.
    const put = await page.request.put(`/api/slides/${slide.id}`, {
      data: { ...slide, title: 'E2E Slide renamed' },
    })
    expect(put.ok()).toBe(true)
    let row = await prisma.slide.findUniqueOrThrow({ where: { id: slide.id } })
    expect(row.mobileImageUrl).toBe(MOBILE_SRC)

    const del = await page.request.delete(`/api/slides/${slide.id}/image?variant=mobile`)
    expect(del.ok()).toBe(true)
    row = await prisma.slide.findUniqueOrThrow({ where: { id: slide.id } })
    expect(row.mobileImageUrl, 'removed → falls back to desktop').toBeNull()
    expect(row.imageUrl, 'the desktop image is untouched').toBe(DESKTOP_SRC)
  } finally {
    await prisma.slide.deleteMany({ where: { id: slide.id } })
  }
})
