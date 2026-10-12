import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

import { getAdminCredentials } from './auth-helpers'
import { fixtures } from './fixtures'

/**
 * `POST /api/artworks/reorder` takes the artist's artwork ids in their new
 * order and writes each one's index into `order`.
 *
 * It used to run one UPDATE per artwork inside a $transaction. Every UPDATE
 * is a round-trip to the database, and Prisma aborts a transaction after 5s,
 * so an artist with 83 works could no longer reorder in prod (AR-158). 150
 * works is past that limit even from a dev machine, so this list size fails
 * on the old code and must succeed on the single-statement one.
 *
 * Ownership is enforced per row: an id belonging to another user is skipped
 * rather than written, and a stale id that no longer exists does not fail
 * the whole save.
 *
 * Talks to the route directly. No WebGL.
 */
test.use({ storageState: 'e2e/.auth/artist.json' })

const COUNT = 150

test('reorders a large portfolio in one save, skipping stale and foreign ids', async ({
  request,
}) => {
  test.setTimeout(60_000)
  const owner = await prisma.user.findUniqueOrThrow({
    where: { handler: fixtures.artistSlug },
    select: { id: true },
  })
  const other = await prisma.user.findUniqueOrThrow({
    where: { email: getAdminCredentials().email },
    select: { id: true },
  })
  const stamp = `${Date.now()}-${Math.round(Math.random() * 1e6)}`

  await prisma.artwork.createMany({
    data: Array.from({ length: COUNT }, (_, i) => ({
      userId: owner.id,
      name: `E2E Reorder ${i}`,
      slug: `e2e-reorder-${stamp}-${i}`,
      order: i,
    })),
  })
  const foreign = await prisma.artwork.create({
    data: {
      userId: other.id,
      name: 'E2E Reorder Foreign',
      slug: `e2e-reorder-${stamp}-foreign`,
      order: 7,
    },
    select: { id: true },
  })

  try {
    const created = await prisma.artwork.findMany({
      where: { slug: { startsWith: `e2e-reorder-${stamp}-` }, userId: owner.id },
      orderBy: { order: 'asc' },
      select: { id: true },
    })
    expect(created).toHaveLength(COUNT)

    const reversed = created.map((a) => a.id).reverse()
    const res = await request.post('/api/artworks/reorder', {
      data: { artworkIds: [foreign.id, ...reversed, 'stale-id-that-does-not-exist'] },
    })
    expect(res.ok(), `reorder should succeed: ${res.status()} ${await res.text()}`).toBe(true)

    const after = await prisma.artwork.findMany({
      where: { id: { in: reversed } },
      select: { id: true, order: true },
    })
    const orderById = new Map(after.map((a) => [a.id, a.order]))
    // The foreign id held index 0, so the artist's own works start at 1.
    expect(reversed.map((id) => orderById.get(id))).toEqual(reversed.map((_, i) => i + 1))

    const foreignAfter = await prisma.artwork.findUniqueOrThrow({
      where: { id: foreign.id },
      select: { order: true },
    })
    expect(foreignAfter.order, "another user's artwork is never written").toBe(7)
  } finally {
    await prisma.artwork.deleteMany({ where: { slug: { startsWith: `e2e-reorder-${stamp}-` } } })
  }
})
