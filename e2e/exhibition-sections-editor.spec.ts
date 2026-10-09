import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

import { fixtures } from './fixtures'
import { seedCookieConsent } from './consent-helpers'

/**
 * The Sections block on the exhibition settings page. Every action saves on
 * its own — add, rename, delete, drag — so each test reloads and reads the DB
 * to prove it stuck. Dragging uses dnd-kit's keyboard sensor (focus the
 * handle, Space, arrow, Space) — the same code path as a mouse drop, and far
 * steadier in a headless browser.
 *
 * No WebGL: the settings page is plain DOM.
 */
test.use({ storageState: 'e2e/.auth/artist.json' })

function stamp() {
  return `${Date.now()}-${Math.round(Math.random() * 1e6)}`
}

async function createExhibition() {
  const owner = await prisma.user.findUniqueOrThrow({
    where: { handler: fixtures.artistSlug },
    select: { id: true, handler: true },
  })
  const exhibition = await prisma.exhibition.create({
    data: {
      userId: owner.id,
      handler: owner.handler,
      mainTitle: 'E2E Sections Editor',
      url: `e2e-sections-editor-${stamp()}`,
      spaceId: 'paris',
      status: 'current',
    },
    select: { id: true },
  })
  return { owner, exhibition }
}

const titlesInDb = async (exhibitionId: string) =>
  (
    await prisma.exhibitionSection.findMany({
      where: { exhibitionId },
      orderBy: { order: 'asc' },
      select: { title: true },
    })
  ).map((s) => s.title)

test('add sections, with errors on blank and duplicate names', async ({ page }) => {
  const { exhibition } = await createExhibition()
  try {
    await seedCookieConsent(page)
    await page.goto(`/dashboard/exhibitions/${exhibition.id}/settings`)
    await expect(page.getByRole('heading', { name: 'Sections' })).toBeVisible()

    const input = page.getByLabel('New section name')
    const add = page.getByRole('button', { name: 'Add section' })

    await add.click()
    await expect(page.getByText('Section name is required.')).toBeVisible()
    await input.fill('M')
    await expect(page.getByText('Section name is required.')).toHaveCount(0)

    await input.fill('Magnolia')
    await add.click()
    await expect(page.locator('[data-section-row]', { hasText: 'Magnolia' })).toBeVisible()
    await expect(input).toHaveValue('')

    await input.fill('Mistery')
    await input.press('Enter')
    await expect(page.locator('[data-section-row]', { hasText: 'Mistery' })).toBeVisible()

    await input.fill('magnolia')
    await add.click()
    await expect(
      page.getByText('This exhibition already has a section with that name.'),
    ).toBeVisible()

    await expect.poll(() => titlesInDb(exhibition.id)).toEqual(['Magnolia', 'Mistery'])
    await page.reload()
    await expect(page.locator('[data-section-row]')).toHaveCount(2)
  } finally {
    await prisma.exhibition.delete({ where: { id: exhibition.id } })
  }
})

test('rename keeps the works in the section', async ({ page }) => {
  const { owner, exhibition } = await createExhibition()
  const section = await prisma.exhibitionSection.create({
    data: { exhibitionId: exhibition.id, title: 'Mistery', order: 0 },
  })
  const artwork = await prisma.artwork.create({
    data: { userId: owner.id, name: 'E2E Editor Work', slug: `e2e-editor-work-${stamp()}` },
  })
  await prisma.exhibitionArtwork.create({
    data: {
      exhibitionId: exhibition.id,
      artworkId: artwork.id,
      showOnPage: true,
      sectionId: section.id,
    },
  })
  try {
    await seedCookieConsent(page)
    await page.goto(`/dashboard/exhibitions/${exhibition.id}/settings`)

    const row = page.locator(`[data-section-id="${section.id}"]`)
    await row.getByRole('button', { name: 'Rename' }).click()
    const field = row.getByLabel('Section name')
    await field.fill('Mystery')
    await field.press('Enter')
    await expect(row).toContainText('Mystery')

    await expect.poll(() => titlesInDb(exhibition.id)).toEqual(['Mystery'])
    const member = await prisma.exhibitionArtwork.findUniqueOrThrow({
      where: { exhibitionId_artworkId: { exhibitionId: exhibition.id, artworkId: artwork.id } },
    })
    expect(member.sectionId).toBe(section.id)
  } finally {
    await prisma.exhibition.delete({ where: { id: exhibition.id } })
    await prisma.artwork.delete({ where: { id: artwork.id } })
  }
})

test('drag to reorder persists', async ({ page }) => {
  const { exhibition } = await createExhibition()
  await prisma.exhibitionSection.createMany({
    data: ['Magnolia', 'Mistery', 'Memory'].map((title, order) => ({
      exhibitionId: exhibition.id,
      title,
      order,
    })),
  })
  try {
    await seedCookieConsent(page)
    await page.goto(`/dashboard/exhibitions/${exhibition.id}/settings`)

    const ids = Object.fromEntries(
      (
        await prisma.exhibitionSection.findMany({
          where: { exhibitionId: exhibition.id },
          select: { id: true, title: true },
        })
      ).map((s) => [s.title, s.id]),
    )
    // dnd-kit measures the rows a frame after the drag starts, so keys sent
    // back to back are dropped. Its live region announces every move — wait
    // for each announcement before the next key instead of guessing a delay.
    const live = page.locator('[id^="DndLiveRegion"]')
    const handle = page.getByRole('button', { name: 'Drag to reorder Memory' })
    await handle.focus()
    await page.keyboard.press('Space')
    await expect(live).toContainText(`over droppable area ${ids.Memory}`)
    await page.keyboard.press('ArrowUp')
    await expect(live).toContainText(`over droppable area ${ids.Mistery}`)
    await page.keyboard.press('ArrowUp')
    await expect(live).toContainText(`over droppable area ${ids.Magnolia}`)
    await page.keyboard.press('Space')

    await expect.poll(() => titlesInDb(exhibition.id)).toEqual(['Memory', 'Magnolia', 'Mistery'])
    await page.reload()
    await expect(page.locator('[data-section-row]')).toHaveText([/Memory/, /Magnolia/, /Mistery/])
  } finally {
    await prisma.exhibition.delete({ where: { id: exhibition.id } })
  }
})

test('delete asks first, says how many works move, and keeps them', async ({ page }) => {
  const { owner, exhibition } = await createExhibition()
  const section = await prisma.exhibitionSection.create({
    data: { exhibitionId: exhibition.id, title: 'Memory', order: 0 },
  })
  const artwork = await prisma.artwork.create({
    data: { userId: owner.id, name: 'E2E Editor Delete', slug: `e2e-editor-delete-${stamp()}` },
  })
  await prisma.exhibitionArtwork.create({
    data: {
      exhibitionId: exhibition.id,
      artworkId: artwork.id,
      showOnPage: true,
      sectionId: section.id,
    },
  })
  try {
    await seedCookieConsent(page)
    await page.goto(`/dashboard/exhibitions/${exhibition.id}/settings`)

    await page
      .locator(`[data-section-id="${section.id}"]`)
      .getByRole('button', { name: 'Delete' })
      .click()
    await expect(
      page.getByText('1 artwork will move to no section. It stays on the page.'),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Delete section' }).click()

    await expect(page.locator('[data-section-row]')).toHaveCount(0)
    await expect.poll(() => titlesInDb(exhibition.id)).toEqual([])
    const member = await prisma.exhibitionArtwork.findUniqueOrThrow({
      where: { exhibitionId_artworkId: { exhibitionId: exhibition.id, artworkId: artwork.id } },
    })
    expect(member.sectionId).toBeNull()
    expect(member.showOnPage).toBe(true)
  } finally {
    await prisma.exhibition.delete({ where: { id: exhibition.id } })
    await prisma.artwork.delete({ where: { id: artwork.id } })
  }
})

test('a reorder that never reaches the server snaps back with an error', async ({ page }) => {
  const { exhibition } = await createExhibition()
  await prisma.exhibitionSection.createMany({
    data: ['Magnolia', 'Mistery'].map((title, order) => ({
      exhibitionId: exhibition.id,
      title,
      order,
    })),
  })
  const ids = Object.fromEntries(
    (
      await prisma.exhibitionSection.findMany({
        where: { exhibitionId: exhibition.id },
        select: { id: true, title: true },
      })
    ).map((s) => [s.title, s.id]),
  )
  try {
    await seedCookieConsent(page)
    // Offline, DNS failure, a blocked host: fetch throws instead of returning.
    await page.route('**/sections/order', (route) => route.abort('internetdisconnected'))
    await page.goto(`/dashboard/exhibitions/${exhibition.id}/settings`)

    const live = page.locator('[id^="DndLiveRegion"]')
    await page.getByRole('button', { name: 'Drag to reorder Mistery' }).focus()
    await page.keyboard.press('Space')
    await expect(live).toContainText(`over droppable area ${ids.Mistery}`)
    await page.keyboard.press('ArrowUp')
    await expect(live).toContainText(`over droppable area ${ids.Magnolia}`)
    await page.keyboard.press('Space')

    await expect(page.getByText('Failed to reorder sections')).toBeVisible()
    await expect(page.locator('[data-section-row]')).toHaveText([/Magnolia/, /Mistery/])
    expect(await titlesInDb(exhibition.id)).toEqual(['Magnolia', 'Mistery'])
  } finally {
    await prisma.exhibition.delete({ where: { id: exhibition.id } })
  }
})
