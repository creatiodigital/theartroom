import { test, expect, type APIRequestContext } from '@playwright/test'

import prisma from '@/lib/prisma'

import { fixtures } from './fixtures'

/**
 * AR-183 Lightbox (docs/lightbox "Data"): the wall save and the presets store a lightbox, and
 * refuse values out of range, unknown ones, and a lightbox on anything but an image. Talks to the
 * endpoints directly on throwaway rows. No WebGL.
 */
test.use({ storageState: 'e2e/.auth/artist.json' })

const stamp = () => `${Date.now()}-${Math.round(Math.random() * 1e6)}`

const lightbox = {
  showLightbox: true,
  lightboxBrightness: 0.8,
  lightboxLight: 'warm',
  lightboxDepth: 12,
  lightboxEdge: 'wide',
  lightboxMaterial: 'oak',
  lightboxFront: 'glossy',
}

const placement = {
  wallId: 'wall0',
  posX2d: 10,
  posY2d: 10,
  width2d: 400,
  height2d: 300,
  posX3d: 1,
  posY3d: 1.5,
  posZ3d: 1,
  quaternionX: 0,
  quaternionY: 0,
  quaternionZ: 0,
  quaternionW: 1,
}

async function setup() {
  const owner = await prisma.user.findUniqueOrThrow({
    where: { handler: fixtures.artistSlug },
    select: { id: true, handler: true },
  })
  const s = stamp()
  const exhibition = await prisma.exhibition.create({
    data: {
      userId: owner.id,
      handler: owner.handler,
      mainTitle: 'E2E Lightbox',
      url: `e2e-lightbox-${s}`,
      spaceId: 'paris',
      status: 'draft',
    },
    select: { id: true },
  })
  const image = await prisma.artwork.create({
    data: { userId: owner.id, name: 'E2E Lightbox Image', slug: `e2e-lightbox-image-${s}` },
    select: { id: true },
  })
  const text = await prisma.artwork.create({
    data: {
      userId: owner.id,
      name: 'E2E Lightbox Text',
      slug: `e2e-lightbox-text-${s}`,
      artworkType: 'text',
    },
    select: { id: true },
  })
  return { exhibition, image, text }
}

async function teardown(ids: {
  exhibition: { id: string }
  image: { id: string }
  text: { id: string }
}) {
  await prisma.exhibition.deleteMany({ where: { id: ids.exhibition.id } })
  await prisma.artwork.deleteMany({ where: { id: { in: [ids.image.id, ids.text.id] } } })
}

const save = (request: APIRequestContext, exhibitionId: string, positions: object[]) =>
  request.post('/api/exhibition-artworks', { data: { exhibitionId, positions } })

test.describe('the wall save and a lightbox', () => {
  test('stores a lightbox on an image, and reads it back for the editor', async ({ request }) => {
    const ids = await setup()
    try {
      const res = await save(request, ids.exhibition.id, [
        { artworkId: ids.image.id, ...placement, ...lightbox },
      ])
      expect(res.ok(), `save: ${res.status()} ${await res.text()}`).toBe(true)

      const row = await prisma.exhibitionArtwork.findUniqueOrThrow({
        where: {
          exhibitionId_artworkId: { exhibitionId: ids.exhibition.id, artworkId: ids.image.id },
        },
      })
      expect(row).toMatchObject(lightbox)

      const read = await request.get(
        `/api/exhibition-artworks?exhibitionId=${ids.exhibition.id}&mode=edit`,
      )
      expect(read.ok()).toBe(true)
      const rows = (await read.json()) as Record<string, unknown>[]
      expect(rows.find((r) => r.artworkId === ids.image.id)).toMatchObject(lightbox)
    } finally {
      await teardown(ids)
    }
  })

  test('refuses values out of range or unknown, and changes nothing', async ({ request }) => {
    const ids = await setup()
    try {
      const ok = await save(request, ids.exhibition.id, [
        { artworkId: ids.image.id, ...placement, ...lightbox },
      ])
      expect(ok.ok()).toBe(true)

      for (const bad of [
        { lightboxDepth: 20 },
        { lightboxBrightness: 2 },
        { lightboxEdge: 'medium' },
        { lightboxMaterial: 'brass' },
        { lightboxLight: 'daylight' },
        { lightboxFront: 'satin' },
      ]) {
        const res = await save(request, ids.exhibition.id, [
          { artworkId: ids.image.id, ...placement, ...lightbox, ...bad },
        ])
        expect(res.status(), JSON.stringify(bad)).toBe(400)
      }

      const row = await prisma.exhibitionArtwork.findUniqueOrThrow({
        where: {
          exhibitionId_artworkId: { exhibitionId: ids.exhibition.id, artworkId: ids.image.id },
        },
      })
      expect(row).toMatchObject(lightbox)
    } finally {
      await teardown(ids)
    }
  })

  test('refuses a lightbox on a text', async ({ request }) => {
    const ids = await setup()
    try {
      const res = await save(request, ids.exhibition.id, [
        { artworkId: ids.text.id, ...placement, showLightbox: true },
      ])
      expect(res.status()).toBe(400)
      expect(await res.text()).toMatch(/image/)
      // Off, as the editor sends every text, it saves.
      const off = await save(request, ids.exhibition.id, [
        { artworkId: ids.text.id, ...placement, showLightbox: false },
      ])
      expect(off.ok(), `save: ${off.status()} ${await off.text()}`).toBe(true)
    } finally {
      await teardown(ids)
    }
  })
})

test.describe('presets and a lightbox', () => {
  test('an image preset saves and updates its lightbox; bad values and a text one are refused', async ({
    request,
  }) => {
    const created: string[] = []
    try {
      const res = await request.post('/api/presets', {
        data: { name: `E2E Lightbox preset ${stamp()}`, presetType: 'image', ...lightbox },
      })
      expect(res.status(), await res.text()).toBe(201)
      const preset = (await res.json()) as { id: string } & Record<string, unknown>
      created.push(preset.id)
      expect(preset).toMatchObject(lightbox)

      // A field left out keeps the preset's.
      const put = await request.put(`/api/presets/${preset.id}`, { data: { lightboxDepth: 4 } })
      expect(put.ok()).toBe(true)
      expect(await put.json()).toMatchObject({ ...lightbox, lightboxDepth: 4 })

      const bad = await request.put(`/api/presets/${preset.id}`, {
        data: { lightboxEdge: 'medium' },
      })
      expect(bad.status()).toBe(400)

      const text = await request.post('/api/presets', {
        data: {
          name: `E2E Lightbox text preset ${stamp()}`,
          presetType: 'text',
          showLightbox: true,
        },
      })
      expect(text.status()).toBe(400)
    } finally {
      await prisma.artworkPreset.deleteMany({ where: { id: { in: created } } })
    }
  })
})
