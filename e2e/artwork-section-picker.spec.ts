import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

import { fixtures } from './fixtures'
import { seedCookieConsent } from './consent-helpers'

/**
 * The section dropdown under each ticked exhibition on the artwork form. It
 * appears only for ticked exhibitions that have sections, pre-selects the
 * saved section, and saves with the normal Save button.
 *
 * `SelectDropdown` is a button (named by the selected label) that opens a
 * listbox of `role="option"` items.
 *
 * No WebGL: the dashboard edit form is plain DOM.
 */
test.use({ storageState: 'e2e/.auth/artist.json' })

function stamp() {
  return `${Date.now()}-${Math.round(Math.random() * 1e6)}`
}

async function setup() {
  const owner = await prisma.user.findUniqueOrThrow({
    where: { handler: fixtures.artistSlug },
    select: { id: true, handler: true },
  })
  const mk = (mainTitle: string) =>
    prisma.exhibition.create({
      data: {
        userId: owner.id,
        handler: owner.handler,
        mainTitle,
        url: `e2e-picker-sections-${stamp()}`,
        spaceId: 'paris',
        status: 'current',
        published: true,
      },
      select: { id: true },
    })
  const withSections = await mk('E2E Picker With Sections')
  const without = await mk('E2E Picker Without Sections')
  const magnolia = await prisma.exhibitionSection.create({
    data: { exhibitionId: withSections.id, title: 'E2E Magnolia', order: 0 },
  })
  await prisma.exhibitionSection.create({
    data: { exhibitionId: withSections.id, title: 'E2E Memory', order: 1 },
  })
  const artwork = await prisma.artwork.create({
    data: { userId: owner.id, name: 'E2E Picker Sections Work', slug: `e2e-pick-sec-${stamp()}` },
    select: { id: true },
  })
  const cleanup = async () => {
    await prisma.exhibition.deleteMany({ where: { id: { in: [withSections.id, without.id] } } })
    await prisma.artwork.deleteMany({ where: { id: artwork.id } })
  }
  return { withSections, without, magnolia, artwork, cleanup }
}

test('choose a section for a ticked exhibition and save', async ({ page }) => {
  const s = await setup()
  try {
    await seedCookieConsent(page)
    await page.goto(`/dashboard/artworks/${s.artwork.id}/edit`)

    const withRow = page.locator(`[data-exhibition-row="${s.withSections.id}"]`)
    const withoutRow = page.locator(`[data-exhibition-row="${s.without.id}"]`)

    // Unticked: no dropdown anywhere.
    await expect(withRow.locator('[aria-haspopup="listbox"]')).toHaveCount(0)

    await page.locator('label', { hasText: 'E2E Picker With Sections' }).click()
    await page.locator('label', { hasText: 'E2E Picker Without Sections' }).click()

    // Ticked + has sections → dropdown; ticked + no sections → none.
    await expect(withoutRow.locator('[aria-haspopup="listbox"]')).toHaveCount(0)
    await withRow.getByRole('button', { name: 'No section' }).click()
    await expect(page.getByRole('option')).toHaveText(['No section', 'E2E Magnolia', 'E2E Memory'])
    await page.getByRole('option', { name: 'E2E Magnolia' }).click()

    await page.getByRole('button', { name: /^Save$/ }).click()
    await page.waitForURL('**/dashboard/artworks', { timeout: 15000 })

    const member = await prisma.exhibitionArtwork.findUniqueOrThrow({
      where: {
        exhibitionId_artworkId: { exhibitionId: s.withSections.id, artworkId: s.artwork.id },
      },
    })
    expect(member.sectionId).toBe(s.magnolia.id)
  } finally {
    await s.cleanup()
  }
})

test('the saved section is pre-selected and survives an unrelated save', async ({ page }) => {
  const s = await setup()
  await prisma.exhibitionArtwork.create({
    data: {
      exhibitionId: s.withSections.id,
      artworkId: s.artwork.id,
      showOnPage: true,
      sectionId: s.magnolia.id,
    },
  })
  try {
    await seedCookieConsent(page)
    await page.goto(`/dashboard/artworks/${s.artwork.id}/edit`)

    const withRow = page.locator(`[data-exhibition-row="${s.withSections.id}"]`)
    await expect(withRow.getByRole('button', { name: 'E2E Magnolia' })).toBeVisible()

    await page.getByRole('button', { name: /^Save$/ }).click()
    await page.waitForURL('**/dashboard/artworks', { timeout: 15000 })

    const member = await prisma.exhibitionArtwork.findUniqueOrThrow({
      where: {
        exhibitionId_artworkId: { exhibitionId: s.withSections.id, artworkId: s.artwork.id },
      },
    })
    expect(member.sectionId).toBe(s.magnolia.id)
  } finally {
    await s.cleanup()
  }
})

test('re-ticking a hung work saves the section shown, not a stale one', async ({ page }) => {
  const s = await setup()
  // Hung in the room but unticked from the page, still carrying its old section.
  await prisma.exhibitionArtwork.create({
    data: {
      exhibitionId: s.withSections.id,
      artworkId: s.artwork.id,
      showOnPage: false,
      sectionId: s.magnolia.id,
      wallId: 'wall0',
      posX2d: 1,
      posY2d: 1,
      width2d: 1,
      height2d: 1,
      posX3d: 1,
      posY3d: 1,
      posZ3d: 1,
      quaternionX: 0,
      quaternionY: 0,
      quaternionZ: 0,
      quaternionW: 1,
    },
  })
  try {
    await seedCookieConsent(page)
    await page.goto(`/dashboard/artworks/${s.artwork.id}/edit`)

    await page.locator('label', { hasText: 'E2E Picker With Sections' }).click()
    const withRow = page.locator(`[data-exhibition-row="${s.withSections.id}"]`)
    await expect(withRow.getByRole('button', { name: 'No section' })).toBeVisible()

    await page.getByRole('button', { name: /^Save$/ }).click()
    await page.waitForURL('**/dashboard/artworks', { timeout: 15000 })

    const member = await prisma.exhibitionArtwork.findUniqueOrThrow({
      where: {
        exhibitionId_artworkId: { exhibitionId: s.withSections.id, artworkId: s.artwork.id },
      },
    })
    expect(member.showOnPage).toBe(true)
    expect(member.sectionId, 'the dropdown said No section').toBeNull()
  } finally {
    await s.cleanup()
  }
})
