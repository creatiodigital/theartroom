import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'
import { needsRender } from '@/lib/printPresentation/currentInputs'
import { getPrintPresentations } from '@/lib/printPresentation/getPrintPresentations'
import { presentationInputs } from '@/lib/printPresentation/inputs'
import { loadPresentationSources } from '@/lib/printPresentation/loadSources'
import { photoInputs, renderCopy } from '@/lib/printPresentation/photoInputs'
import { PHOTO_VIEWS, type PrintPresentationRecord } from '@/lib/printPresentation/record'
import { newRenderId, photoPublicUrls, presentationPublicUrls } from '@/lib/printPresentation/storage'
import { getPrintPresentationsEnabled } from '@/lib/settings'

import { setupLimitedFixture, teardownLimitedFixture } from './edition-helpers'

/**
 * Print photo views on public pages (2026-11-20). A page gets a work's three photos only while
 * they are current — its image and print as they were when rendered — and their files load here:
 * a photo of an OLD image must never show (the artwork is in these renders). A sale never hides
 * anything: it only tells the admin the work needs a render (the pencilled copy has sold).
 *
 * Database only (records written directly; no WebGL, no server).
 */
const IMAGE = 'https://assets.example/e2e-photo-views-1.webp'

async function withRenderedWork(run: (artworkId: string, variantId: string) => Promise<void>) {
  const fx = await setupLimitedFixture(5)
  try {
    await prisma.artwork.update({ where: { id: fx.artworkId }, data: { imageUrl: IMAGE } })
    const [source] = await loadPresentationSources({ ids: [fx.artworkId] })
    const inputs = presentationInputs(source)!
    const photo = photoInputs(source, inputs)!
    const renderId = newRenderId()
    const record: PrintPresentationRecord = {
      fingerprint: inputs.fingerprint,
      mode: inputs.mode,
      edition: inputs.edition,
      window: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
      aspect: 1,
      urls: presentationPublicUrls(fx.artworkId, inputs.fingerprint, renderId),
      renderedAt: new Date().toISOString(),
      frame: inputs.frame ?? 'none',
      passepartout: inputs.passepartout,
      ratio: inputs.ratio,
      renderId,
      copy: renderCopy(source, inputs)!,
      views: {
        fingerprint: photo.fingerprint,
        urls: photoPublicUrls(fx.artworkId, photo.fingerprint, renderId),
        renderedAt: new Date().toISOString(),
      },
    }
    await prisma.artwork.update({ where: { id: fx.artworkId }, data: { printPresentation: record } })
    await run(fx.artworkId, fx.variantId)
  } finally {
    await teardownLimitedFixture(fx)
  }
}

const state = async (artworkId: string) => {
  const [source] = await loadPresentationSources({ ids: [artworkId] })
  const inputs = presentationInputs(source)
  return needsRender(artworkId, source.record, inputs, photoInputs(source, inputs), renderCopy(source, inputs))
}

test.describe('photo views on public pages', () => {
  test.beforeEach(async () => {
    test.skip(!(await getPrintPresentationsEnabled()), 'presentations are switched off in this database')
  })

  test('four views when current; nothing to render', async () => {
    await withRenderedWork(async (id) => {
      const view = (await getPrintPresentations([id]))[id]
      expect(view).toBeTruthy()
      expect(Object.keys(view.photos ?? {}).sort()).toEqual([...PHOTO_VIEWS].sort())
      expect(view.photos!.sheet.large).toMatch(/-sheet-2400\.webp$/)
      expect(await state(id)).toBe(false)
    })
  })

  test('a new image hides the photos, keeps the framed view, and asks for a render', async () => {
    await withRenderedWork(async (id) => {
      await prisma.artwork.update({ where: { id }, data: { imageUrl: 'https://assets.example/e2e-photo-views-2.webp' } })
      const view = (await getPrintPresentations([id]))[id]
      expect(view).toBeTruthy()
      expect(view.photos).toBeUndefined()
      expect(await state(id)).toBe(true)
    })
  })

  test('a sold copy flags the work but never hides its photos', async () => {
    await withRenderedWork(async (id, variantId) => {
      await prisma.editionNumber.updateMany({ where: { variantId, number: 1 }, data: { state: 'sold' } })
      const view = (await getPrintPresentations([id]))[id]
      expect(view.photos).toBeTruthy()
      expect(await state(id)).toBe(true)
    })
  })

  test('a render without photos (made before them) shows framed only and asks for a render', async () => {
    await withRenderedWork(async (id) => {
      const row = await prisma.artwork.findUniqueOrThrow({ where: { id }, select: { printPresentation: true } })
      const { views: _views, copy: _copy, ...older } = row.printPresentation as PrintPresentationRecord
      await prisma.artwork.update({ where: { id }, data: { printPresentation: older } })
      const view = (await getPrintPresentations([id]))[id]
      expect(view).toBeTruthy()
      expect(view.photos).toBeUndefined()
      expect(await state(id)).toBe(true)
    })
  })
})
