import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

import { fixtures } from './fixtures'

test.use({ storageState: 'e2e/.auth/admin.json' })

const stamp = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

/**
 * The editor's Windows panel saves one frame and radiator color for
 * the whole space. The scene itself is not mounted here (no WebGL in e2e), so this pins
 * the two things the panel depends on: a new exhibition starts on the colors
 * these always had, and the colors round-trip through the save endpoint.
 */
test('window and radiator colors default to the originals and save', async ({ request }) => {
  const owner = await prisma.artwork.findFirst({
    where: { slug: fixtures.artworkSlug },
    select: { userId: true },
  })
  test.skip(!owner, 'needs the fixture artwork/artist in the dev DB')

  const s = stamp()
  const ex = await prisma.exhibition.create({
    data: {
      userId: owner!.userId,
      handler: `e2e-wc-${s}`,
      mainTitle: 'E2E Window Color',
      url: `e2e-window-color-${s}`,
      spaceId: 'paris',
      status: 'draft',
    },
    select: { id: true, windowFrameColor: true, radiatorColor: true },
  })

  try {
    // Existing exhibitions must look exactly as before the setting existed.
    expect(ex.windowFrameColor).toBe('#e8e8e8')
    expect(ex.radiatorColor).toBe('#e8e8e8')

    const res = await request.put(`/api/exhibitions/${ex.id}`, {
      data: { windowFrameColor: '#c8b8a0', radiatorColor: '#d0c4b0' },
    })
    expect(res.ok(), `save failed: ${res.status()}`).toBe(true)

    const after = await prisma.exhibition.findUnique({
      where: { id: ex.id },
      select: { windowFrameColor: true, radiatorColor: true },
    })
    expect(after).toEqual({
      windowFrameColor: '#c8b8a0',
      radiatorColor: '#d0c4b0',
    })
  } finally {
    await prisma.exhibition.deleteMany({ where: { id: ex.id } })
  }
})
