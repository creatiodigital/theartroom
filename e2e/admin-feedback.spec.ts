import { randomInt } from 'node:crypto'

import { test, expect } from '@playwright/test'

import { receivedLabel } from '@/lib/feedback/receivedLabel'
import prisma from '@/lib/prisma'

import { seedCookieConsent } from './consent-helpers'

// Admin · Gallery › Feedback (F1, docs/admin-redesign/feedback-list.md): every visitor feedback,
// newest first, filtered by where it came from, plain text, and a Delete that asks first; the
// delete route refuses anyone but an admin, other sites, and ids that aren't one.
//
// Its own rows only (MARKER), dated just after now so they top the list whatever else is stored;
// all removed afterwards.

const MARKER = `E2E-ADMIN-FEEDBACK-${Date.now()}-${randomInt(1e6)}`
const BASE = 'http://localhost:3001'
const ORIGIN = { origin: BASE }

let roomWithExhibition = ''
let home = ''
let roomAlone = ''
let exhibitionTitle = ''

test.beforeAll(async () => {
  const exhibition = await prisma.exhibition.findFirst({ select: { id: true, mainTitle: true } })
  exhibitionTitle = exhibition?.mainTitle ?? ''
  const at = (minutes: number) => new Date(Date.now() + minutes * 60_000)
  // Newest first: the room with an exhibition, the home page, the room without one.
  roomWithExhibition = (
    await prisma.feedback.create({
      data: {
        message: `${MARKER} room: loved the photographs`,
        source: 'room',
        exhibitionId: exhibition?.id ?? null,
        createdAt: at(3),
      },
    })
  ).id
  home = (
    await prisma.feedback.create({
      data: {
        message: `${MARKER} home: <b>not bold</b>\nsecond line`,
        source: 'home',
        createdAt: at(2),
      },
    })
  ).id
  roomAlone = (
    await prisma.feedback.create({
      data: { message: `${MARKER} room: no exhibition`, source: 'room', createdAt: at(1) },
    })
  ).id
})

test.afterAll(async () => {
  await prisma.feedback.deleteMany({ where: { message: { contains: MARKER } } })
})

const markedRows = (page: import('@playwright/test').Page) =>
  page.locator('tbody tr').filter({ hasText: MARKER })

test.describe('as an admin', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' })

  test('newest first, filtered by where it came from', async ({ page }) => {
    await seedCookieConsent(page)
    await page.goto('/admin/feedback')
    await expect(page.getByRole('heading', { name: 'Feedback', level: 1 })).toBeVisible()
    await expect(
      page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Feedback' }),
    ).toBeVisible()

    const rows = markedRows(page)
    await expect(rows).toHaveCount(3)
    await expect(rows.nth(0)).toContainText('loved the photographs')
    await expect(rows.nth(1)).toContainText('not bold')
    await expect(rows.nth(2)).toContainText('no exhibition')
    // The room's chip and its exhibition; a room without one has the chip alone.
    await expect(rows.nth(0)).toContainText('3D room')
    if (exhibitionTitle) {
      await expect(rows.nth(0).getByRole('link', { name: exhibitionTitle })).toBeVisible()
    }
    await expect(rows.nth(1)).toContainText('Home page')
    await expect(rows.nth(2).getByRole('link')).toHaveCount(0)

    await page
      .getByRole('group', { name: 'From' })
      .getByRole('button', { name: 'Home page' })
      .click()
    await expect(page).toHaveURL(/from=home/)
    await expect(rows).toHaveCount(1)
    await expect(rows.nth(0)).toContainText('not bold')

    await page
      .getByRole('group', { name: 'From' })
      .getByRole('button', { name: '3D rooms' })
      .click()
    await expect(page).toHaveURL(/from=room/)
    await expect(rows).toHaveCount(2)
  })

  test('a message is shown as plain text, line breaks kept', async ({ page }) => {
    await seedCookieConsent(page)
    await page.goto('/admin/feedback')
    const row = markedRows(page).filter({ hasText: 'not bold' })
    // The tags read as text; nothing in the message became markup.
    await expect(row).toContainText('<b>not bold</b>')
    await expect(row.locator('b')).toHaveCount(0)
    const text = await row.locator('p').first().innerText()
    expect(text).toContain('\nsecond line')
  })

  test('Delete asks first, then the row goes and the bar says so', async ({ page }) => {
    await seedCookieConsent(page)
    await page.goto('/admin/feedback')
    const row = markedRows(page).filter({ hasText: 'no exhibition' })

    await row.getByRole('button', { name: 'Delete this feedback' }).click()
    const dialog = page.getByRole('dialog', { name: 'Delete this feedback?' })
    await expect(dialog).toContainText(`${MARKER} room: no exhibition`)
    await expect(dialog).toContainText('It is removed for good.')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(row).toHaveCount(1)
    expect(await prisma.feedback.count({ where: { id: roomAlone } })).toBe(1)

    await row.getByRole('button', { name: 'Delete this feedback' }).click()
    await page
      .getByRole('dialog', { name: 'Delete this feedback?' })
      .getByRole('button', { name: 'Delete' })
      .click()
    await expect(page.getByText('Feedback deleted.')).toBeVisible()
    await expect(row).toHaveCount(0)
    expect(await prisma.feedback.count({ where: { id: roomAlone } })).toBe(0)
  })

  test('the delete route: another site, a bad id, one already gone', async ({ request }) => {
    expect((await request.delete(`/api/admin/feedback/${home}`)).status()).toBe(403)
    expect(
      (
        await request.delete(`/api/admin/feedback/${home}`, {
          headers: { origin: 'https://evil.example' },
        })
      ).status(),
    ).toBe(403)
    expect(
      (await request.delete('/api/admin/feedback/not-an-id', { headers: ORIGIN })).status(),
    ).toBe(400)
    expect(
      (
        await request.delete('/api/admin/feedback/00000000-0000-4000-8000-000000000000', {
          headers: ORIGIN,
        })
      ).status(),
    ).toBe(404)
    expect(await prisma.feedback.count({ where: { id: home } })).toBe(1)
  })
})

test.describe('anyone else', () => {
  test.use({ storageState: 'e2e/.auth/artist.json' })

  test('an artist can neither open the page nor delete', async ({ page, request }) => {
    await page.goto('/admin/feedback')
    await expect(page).not.toHaveURL(/\/admin\/feedback/)
    expect(
      (await request.delete(`/api/admin/feedback/${home}`, { headers: ORIGIN })).status(),
    ).toBe(403)
    expect(await prisma.feedback.count({ where: { id: home } })).toBe(1)
  })
})

test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('the delete route asks for a sign-in', async ({ request }) => {
    expect(
      (
        await request.delete(`/api/admin/feedback/${roomWithExhibition}`, { headers: ORIGIN })
      ).status(),
    ).toBe(401)
    expect(await prisma.feedback.count({ where: { id: roomWithExhibition } })).toBe(1)
  })
})

test('Received: today, yesterday, a date, the year when not this year (Madrid)', () => {
  const now = new Date('2026-11-14T10:00:00Z') // 11:00 in Madrid
  expect(receivedLabel(new Date('2026-11-14T08:42:00Z'), now)).toBe('Today, 09:42')
  expect(receivedLabel(new Date('2026-11-13T20:10:00Z'), now)).toBe('Yesterday, 21:10')
  expect(receivedLabel(new Date('2026-11-12T17:30:00Z'), now)).toBe('12 Nov, 18:30')
  expect(receivedLabel(new Date('2025-11-12T17:30:00Z'), now)).toBe('12 Nov 2025, 18:30')
  // Madrid's day, not UTC's: 23:30 UTC on the 13th is already the 14th there.
  expect(receivedLabel(new Date('2026-11-13T23:30:00Z'), now)).toBe('Today, 00:30')
  // After the spring clock change (a 23-hour day), yesterday is still yesterday.
  expect(receivedLabel(new Date('2026-03-29T09:00:00Z'), new Date('2026-03-30T00:30:00Z'))).toBe(
    'Yesterday, 11:00',
  )
})
