import { test, expect, type APIRequestContext } from '@playwright/test'

import prisma from '@/lib/prisma'

import { fixtures, routes } from './fixtures'

/**
 * A unique piece's private prices (docs/unique-sales U1): the artist's suggested price, the lowest
 * the gallery accepts and the artist's own price when sold elsewhere.
 *
 *   - The public never sees any of them: no page, no public API.
 *   - The artist's dashboard never returns the lowest acceptable price.
 *
 * They are left out by the Prisma client itself (`PRIVATE_ARTWORK_OMIT` in src/lib/prisma.ts), so a
 * page that spreads a whole row into its props (the artwork page does) cannot leak them. This spec
 * puts recognisable values on a throwaway featured work of the fixture artist and looks for them,
 * and for the field names, in every response.
 */

const SUGGESTED = 7_654_321
const LOWEST = 6_543_210
const ELSEWHERE = 5_432_109
const PRIVATE_KEYS = ['suggestedPriceCents', 'lowestPriceCents', 'soldElsewherePriceCents']

let artwork: { id: string; slug: string; userId: string }

test.beforeAll(async () => {
  const base = await prisma.artwork.findUnique({
    where: { slug: fixtures.artworkSlug },
    select: { userId: true, imageUrl: true, originalWidth: true, originalHeight: true },
  })
  if (!base) throw new Error(`Fixture artwork "${fixtures.artworkSlug}" not found — check dev DB`)
  const slug = `e2e-private-prices-${Date.now().toString(36)}`
  artwork = await prisma.artwork.create({
    data: {
      name: 'E2E Private Prices',
      title: 'E2E Private Prices',
      slug,
      userId: base.userId,
      imageUrl: base.imageUrl,
      originalWidth: base.originalWidth,
      originalHeight: base.originalHeight,
      featured: true,
      saleMode: 'unique',
      suggestedPriceCents: SUGGESTED,
      lowestPriceCents: LOWEST,
      soldElsewherePriceCents: ELSEWHERE,
    },
    select: { id: true, slug: true, userId: true },
  })
})

test.afterAll(async () => {
  if (artwork) await prisma.artwork.delete({ where: { id: artwork.id } }).catch(() => {})
})

async function expectNoPrivate(
  request: APIRequestContext,
  path: string,
  keys: string[],
  values: number[],
) {
  const res = await request.get(path)
  expect(res.ok(), `${path} answered ${res.status()}`).toBe(true)
  const body = await res.text()
  for (const key of keys) expect(body, `${path} returned ${key}`).not.toContain(key)
  for (const value of values) expect(body, `${path} returned ${value}`).not.toContain(String(value))
}

test('the client leaves the private prices out of every query unless one names them', async () => {
  const row = await prisma.artwork.findUnique({ where: { id: artwork.id } })
  for (const key of PRIVATE_KEYS) expect(Object.keys(row ?? {})).not.toContain(key)

  const named = await prisma.artwork.findUnique({
    where: { id: artwork.id },
    select: { suggestedPriceCents: true, lowestPriceCents: true, soldElsewherePriceCents: true },
  })
  expect(named).toEqual({
    suggestedPriceCents: SUGGESTED,
    lowestPriceCents: LOWEST,
    soldElsewherePriceCents: ELSEWHERE,
  })
})

test('no public page or API returns them', async ({ request }) => {
  const exhibition = await prisma.exhibition.findFirst({
    where: { url: fixtures.exhibitionSlug },
    select: { url: true },
  })
  const paths = [
    routes.artwork(artwork.slug),
    `/api/artworks/by-slug/${artwork.slug}`,
    `/api/artworks/${artwork.id}`,
    // The library read answers visitors too (an artist's public works).
    `/api/artworks?userId=${artwork.userId}`,
    routes.artistProfile(),
    routes.exhibition(),
    ...(exhibition ? [`/api/exhibitions/by-url/${exhibition.url}`] : []),
  ]
  for (const path of paths) {
    await expectNoPrivate(request, path, PRIVATE_KEYS, [SUGGESTED, LOWEST, ELSEWHERE])
  }
})

test("the artist's dashboard never returns the lowest acceptable price", async ({
  playwright,
  baseURL,
}) => {
  const artist = await playwright.request.newContext({
    baseURL,
    storageState: 'e2e/.auth/artist.json',
  })
  try {
    for (const path of [`/api/artworks?userId=${artwork.userId}`, `/api/artworks/${artwork.id}`]) {
      await expectNoPrivate(artist, path, ['lowestPriceCents'], [LOWEST])
    }
  } finally {
    await artist.dispose()
  }
})
