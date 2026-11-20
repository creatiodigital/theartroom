import { mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { test, expect } from '@playwright/test'

import { bakeBackend } from '@/lib/bake/bakeStorage'
import {
  PHOTO_VIEWS,
  isPrintPresentationRecord,
  type PrintPresentationRecord,
} from '@/lib/printPresentation/record'
import {
  deletePresentationFiles,
  localPresentationPath,
  newRenderId,
  photoFilesLoadHere,
  photoPublicUrls,
  presentationPublicUrls,
} from '@/lib/printPresentation/storage'

/**
 * Print presentations: what a render is stored as. The framed render and, since 2026-11-20, its
 * three photo views (sheet, close, edge), each render under its own file names: a re-render after a
 * sale keeps both fingerprints (the copy isn't in them), and the files are cached for a year, so a
 * same-name overwrite would keep showing the old number. Records saved before then — no render id,
 * no copy, no photos — stay valid and keep their names (owner: never lose the current framed
 * renders on deploy).
 *
 * Logic only; the cleanup test uses the local backend's folder.
 */
const ARTWORK = 'e2e-storage-spec'
const FP = '0a1b2c3d'
const VIEWS_FP = '4e5f6a7b'

const legacy: PrintPresentationRecord = {
  fingerprint: FP,
  mode: 'framed',
  edition: null,
  window: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
  aspect: 1,
  urls: presentationPublicUrls(ARTWORK, FP),
  renderedAt: '2026-11-01T00:00:00.000Z',
}

const withPhotos = (renderId: string): PrintPresentationRecord => ({
  ...legacy,
  urls: presentationPublicUrls(ARTWORK, FP, renderId),
  renderId,
  copy: 3,
  views: {
    fingerprint: VIEWS_FP,
    urls: photoPublicUrls(ARTWORK, VIEWS_FP, renderId),
    renderedAt: '2026-11-20T00:00:00.000Z',
  },
})

test.describe('print presentation storage', () => {
  test('a record saved before the photos is still valid and keeps its file names', () => {
    expect(isPrintPresentationRecord(legacy)).toBe(true)
    expect(legacy.urls.large.endsWith(`/${FP}-1800.webp`)).toBe(true)
    expect(legacy.urls.small.endsWith(`/${FP}-900.webp`)).toBe(true)
  })

  test('a record with its copy, render id and photos is valid', () => {
    expect(isPrintPresentationRecord(withPhotos(newRenderId()))).toBe(true)
  })

  test('a record with a broken photo URL, render id or copy is refused', () => {
    const good = withPhotos(newRenderId())
    const badUrl = {
      ...good,
      views: { ...good.views!, urls: { ...good.views!.urls, close: { large: 5, small: 'x' } } },
    }
    expect(isPrintPresentationRecord(badUrl)).toBe(false)
    expect(isPrintPresentationRecord({ ...good, renderId: 'zz' })).toBe(false)
    expect(isPrintPresentationRecord({ ...good, copy: 0 })).toBe(false)
    expect(isPrintPresentationRecord({ ...good, views: { ...good.views!, fingerprint: 'nope' } })).toBe(
      false,
    )
  })

  test('each render gets its own file names, even with the same fingerprint', () => {
    const a = newRenderId()
    const b = newRenderId()
    expect(a).toMatch(/^[0-9a-f]{8}$/)
    expect(a).not.toBe(b)
    expect(presentationPublicUrls(ARTWORK, FP, a).large.endsWith(`/${FP}-${a}-1800.webp`)).toBe(true)
    expect(presentationPublicUrls(ARTWORK, FP, a).large).not.toBe(
      presentationPublicUrls(ARTWORK, FP, b).large,
    )
  })

  test('photo files are named by view and size', () => {
    const id = newRenderId()
    const urls = photoPublicUrls(ARTWORK, VIEWS_FP, id)
    expect(Object.keys(urls).sort()).toEqual([...PHOTO_VIEWS].sort())
    expect(urls.sheet.large.endsWith(`/${VIEWS_FP}-${id}-sheet-2400.webp`)).toBe(true)
    expect(urls.edge.small.endsWith(`/${VIEWS_FP}-${id}-edge-600.webp`)).toBe(true)
  })

  test("a record's photos load here only while their URLs are this backend's own", () => {
    const good = withPhotos(newRenderId())
    expect(photoFilesLoadHere(ARTWORK, good)).toBe(true)
    expect(photoFilesLoadHere(ARTWORK, legacy)).toBe(false)
    const moved = {
      ...good,
      views: {
        ...good.views!,
        urls: { ...good.views!.urls, sheet: { ...good.views!.urls.sheet, large: 'https://x.test/a.webp' } },
      },
    }
    expect(photoFilesLoadHere(ARTWORK, moved)).toBe(false)
  })

  test('the local file route serves every stored name, and nothing else', () => {
    const id = newRenderId()
    const ok = [`${FP}-1800.webp`, `${FP}-${id}-900.webp`, `${VIEWS_FP}-${id}-close-2400.webp`]
    for (const name of ok) expect(localPresentationPath(['presentations', ARTWORK, name])).not.toBeNull()
    const bad = ['../x.webp', 'abc.webp', `${VIEWS_FP}-${id}-other-2400.webp`, `${FP}-${id}-1800.png`]
    for (const name of bad) expect(localPresentationPath(['presentations', ARTWORK, name])).toBeNull()
  })

  test("replacing a render deletes only the previous render's files", async () => {
    test.skip(bakeBackend() !== 'local', 'checks the local backend folder')
    const folder = path.join(process.cwd(), '.presentation-files', ARTWORK)
    await mkdir(folder, { recursive: true })
    const previous = withPhotos(newRenderId())
    const next = withPhotos(newRenderId())
    const names = (r: PrintPresentationRecord) =>
      [r.urls.large, r.urls.small, ...PHOTO_VIEWS.flatMap((v) => [r.views!.urls[v].large, r.views!.urls[v].small])].map(
        (url) => url.split('/').pop()!,
      )
    for (const name of [...names(previous), ...names(next)]) {
      await writeFile(path.join(folder, name), 'x')
    }
    await deletePresentationFiles(previous, ARTWORK)
    const exists = async (name: string) =>
      stat(path.join(folder, name)).then(
        () => true,
        () => false,
      )
    for (const name of names(previous)) expect(await exists(name)).toBe(false)
    for (const name of names(next)) expect(await exists(name)).toBe(true)
    await deletePresentationFiles(next, ARTWORK)
    for (const name of names(next)) expect(await exists(name)).toBe(false)
  })
})
