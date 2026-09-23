import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

import { fixtures } from './fixtures'
import { seedCookieConsent } from './consent-helpers'

/**
 * The Exhibitions section on the artwork dashboard form: a checkbox per the
 * artist's own exhibitions, saved through the same PUT as every other field
 * on the form.
 *
 * Two things matter here, and only a real browser proves either:
 *   1. Checking a box and saving creates membership — the round trip the
 *      artist actually performs.
 *   2. EXISTING membership is pre-checked on load. This is not cosmetic: the
 *      form always sends its full `exhibitionIds` state on save (it's just
 *      another field, spread into the same payload as the title and the
 *      featured flag). If the checkbox render ever forgot to hydrate from
 *      the artwork's real membership, the artist could open the editor to
 *      fix an unrelated typo, hit Save, and silently un-curate every show
 *      the work was already in — nothing on screen would suggest a show was
 *      even at stake.
 *
 * The `Checkbox` component hides its native input (`display: none`) and
 * styles a sibling span instead, so interaction goes through the visible
 * `<label>` (which forwards the click to the hidden control, same as a real
 * click) while state reads go through the label's accessible name.
 *
 * No WebGL: the dashboard edit form is plain DOM.
 */
test.use({ storageState: 'e2e/.auth/artist.json' })

async function fixtureOwner() {
  return prisma.user.findUniqueOrThrow({
    where: { handler: fixtures.artistSlug },
    select: { id: true, handler: true },
  })
}

function stamp() {
  return `${Date.now()}-${Math.round(Math.random() * 1e6)}`
}

async function createExhibition(userId: string, handler: string, name: string) {
  const s = stamp()
  return prisma.exhibition.create({
    data: {
      userId,
      handler,
      mainTitle: name,
      url: `e2e-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${s}`,
      spaceId: 'paris',
      status: 'draft',
      // Published so the checkbox label reads the plain title, with no
      // "(draft)" suffix to account for in the assertions below.
      published: true,
    },
    select: { id: true },
  })
}

async function createArtwork(userId: string, name: string) {
  const s = stamp()
  return prisma.artwork.create({
    data: {
      userId,
      name,
      slug: `e2e-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${s}`,
    },
    select: { id: true },
  })
}

test('checking an exhibition on the artwork form creates membership, leaving the other unchecked box alone', async ({
  page,
}) => {
  const owner = await fixtureOwner()
  const exhibitionA = await createExhibition(owner.id, owner.handler, 'E2E Picker Show A')
  const exhibitionB = await createExhibition(owner.id, owner.handler, 'E2E Picker Show B')
  const artwork = await createArtwork(owner.id, 'E2E Picker Artwork')

  try {
    await seedCookieConsent(page)
    await page.goto(`/dashboard/artworks/${artwork.id}/edit`)

    await expect(page.getByRole('heading', { name: 'Exhibitions' })).toBeVisible()

    const rowA = page.locator('label', { hasText: 'E2E Picker Show A' })
    const rowB = page.locator('label', { hasText: 'E2E Picker Show B' })
    await expect(rowA).toBeVisible()
    await expect(rowB).toBeVisible()

    // Neither box starts checked — this is a brand-new artwork with no
    // existing membership anywhere.
    await expect(page.getByLabel('E2E Picker Show A')).not.toBeChecked()
    await expect(page.getByLabel('E2E Picker Show B')).not.toBeChecked()

    await rowA.click()
    await expect(page.getByLabel('E2E Picker Show A')).toBeChecked()

    await page.getByRole('button', { name: /^Save$/ }).click()
    await page.waitForURL('**/dashboard/artworks', { timeout: 15000 })

    const memberRow = await prisma.exhibitionArtwork.findUnique({
      where: {
        exhibitionId_artworkId: { exhibitionId: exhibitionA.id, artworkId: artwork.id },
      },
    })
    expect(memberRow, 'the checked exhibition should have a member row').not.toBeNull()
    expect(memberRow?.showOnPage).toBe(true)
    expect(memberRow?.wallId, 'checked from the page, not hung anywhere').toBeNull()

    const nonMemberRow = await prisma.exhibitionArtwork.findUnique({
      where: {
        exhibitionId_artworkId: { exhibitionId: exhibitionB.id, artworkId: artwork.id },
      },
    })
    expect(nonMemberRow, 'the untouched box must get no row').toBeNull()
  } finally {
    await prisma.exhibition.deleteMany({ where: { id: { in: [exhibitionA.id, exhibitionB.id] } } })
    await prisma.artwork.deleteMany({ where: { id: artwork.id } })
  }
})

test('existing membership is pre-checked, and an unrelated save does not drop it', async ({
  page,
}) => {
  const owner = await fixtureOwner()
  const exhibition = await createExhibition(owner.id, owner.handler, 'E2E Picker Preexisting')
  const artwork = await createArtwork(owner.id, 'E2E Picker Preexisting Artwork')
  await prisma.exhibitionArtwork.create({
    data: { exhibitionId: exhibition.id, artworkId: artwork.id, showOnPage: true },
  })

  try {
    await seedCookieConsent(page)
    await page.goto(`/dashboard/artworks/${artwork.id}/edit`)

    await expect(page.getByRole('heading', { name: 'Exhibitions' })).toBeVisible()
    // The artwork is already a member — the box must reflect that on load,
    // not start blank.
    await expect(page.getByLabel('E2E Picker Preexisting')).toBeChecked()

    // Save with no changes at all — e.g. the artist opened the editor only to
    // fix the title, never touching the Exhibitions section.
    await page.getByRole('button', { name: /^Save$/ }).click()
    await page.waitForURL('**/dashboard/artworks', { timeout: 15000 })

    const row = await prisma.exhibitionArtwork.findUnique({
      where: {
        exhibitionId_artworkId: { exhibitionId: exhibition.id, artworkId: artwork.id },
      },
    })
    expect(row, 'an untouched save must not silently remove existing membership').not.toBeNull()
    expect(row?.showOnPage).toBe(true)
  } finally {
    await prisma.exhibition.deleteMany({ where: { id: exhibition.id } })
    await prisma.artwork.deleteMany({ where: { id: artwork.id } })
  }
})
