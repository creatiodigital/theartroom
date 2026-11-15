import { configureStore } from '@reduxjs/toolkit'
import { test, expect } from '@playwright/test'

import { computeBakeFingerprint } from '../src/lib/bake/fingerprint'
import { isBakeRecord } from '../src/lib/bake/bakeRecord'
import {
  LIGHTBOX_DEFAULTS,
  LIGHTBOX_FIELDS,
  isLightbox,
  lightboxFieldsError,
  lightboxUpdateData,
  readLightbox,
} from '../src/lib/lightbox'
import { mapToArtwork, type ExhibitionArtworkResponse } from '../src/lib/exhibitionArtworkMapper'
import { getArtworkBorderCm } from '../src/components/wallview/constants'
import {
  LIGHTBOX_FEED_MAX,
  lightboxBakeKey,
  lightboxBloomFeed,
} from '../src/components/scene/spaces/objects/Lightbox/lightboxLook'
import artworksReducer, { createArtwork, editArtisticImage } from '../src/redux/slices/artworkSlice'
import type { TArtwork } from '../src/types/artwork'

/**
 * AR-183 Lightbox (docs/lightbox): its values, the server's checks, exclusivity with frame,
 * passepartout, paper border and support, and how the bake sees it. No server, no WebGL.
 */

test.describe('lightbox values', () => {
  test('a row without lightbox values reads as the defaults, off', () => {
    expect(readLightbox(undefined)).toEqual(LIGHTBOX_DEFAULTS)
    expect(readLightbox({})).toEqual(LIGHTBOX_DEFAULTS)
    expect(LIGHTBOX_DEFAULTS).toEqual({
      showLightbox: false,
      lightboxBrightness: 0.55,
      lightboxLight: 'neutral',
      lightboxDepth: 6,
      lightboxEdge: 'thin',
      lightboxMaterial: 'alu-black',
      lightboxFront: 'matte',
    })
  })

  test('an unknown or out-of-range value reads as its default, never as itself', () => {
    const read = readLightbox({
      showLightbox: 'yes',
      lightboxBrightness: 1.5,
      lightboxLight: 'red',
      lightboxDepth: 2,
      lightboxEdge: 'huge',
      lightboxMaterial: 'gold',
      lightboxFront: 'mirror',
    })
    expect(read).toEqual(LIGHTBOX_DEFAULTS)
  })

  test('valid values are kept, the ends of the ranges included', () => {
    const values = {
      showLightbox: true,
      lightboxBrightness: 1,
      lightboxLight: 'cool',
      lightboxDepth: 15,
      lightboxEdge: 'none',
      lightboxMaterial: 'walnut',
      lightboxFront: 'glossy',
    } as const
    expect(readLightbox(values)).toEqual(values)
    expect(readLightbox({ lightboxBrightness: 0, lightboxDepth: 3 })).toMatchObject({
      lightboxBrightness: 0,
      lightboxDepth: 3,
    })
  })

  test('only an image is shown as a lightbox', () => {
    expect(isLightbox({ showLightbox: true, artworkType: 'image' })).toBe(true)
    expect(isLightbox({ showLightbox: true, artworkType: 'text' })).toBe(false)
    expect(isLightbox({ showLightbox: false, artworkType: 'image' })).toBe(false)
  })

  test('a snapshot published before the lightbox maps to a work without one', () => {
    const row = {
      artworkId: 'a1',
      artwork: { id: 'a1', artworkType: 'image', featured: false },
      fontFamily: 'Montserrat',
      fontWeight: '400',
    } as unknown as ExhibitionArtworkResponse
    const artwork = mapToArtwork(row)
    for (const key of LIGHTBOX_FIELDS) expect(artwork[key]).toEqual(LIGHTBOX_DEFAULTS[key])
  })
})

test.describe('the server checks lightbox values', () => {
  test('values sent must be valid; values left out are fine', () => {
    expect(lightboxFieldsError({}, 'image')).toBeNull()
    expect(lightboxFieldsError({ ...LIGHTBOX_DEFAULTS, showLightbox: true }, 'image')).toBeNull()
    const cases: [Record<string, unknown>, RegExp][] = [
      [{ showLightbox: 'true' }, /showLightbox/],
      [{ lightboxBrightness: -0.1 }, /lightboxBrightness/],
      [{ lightboxBrightness: 1.01 }, /lightboxBrightness/],
      [{ lightboxBrightness: '0.5' }, /lightboxBrightness/],
      [{ lightboxLight: 'daylight' }, /lightboxLight/],
      [{ lightboxDepth: 2.9 }, /lightboxDepth/],
      [{ lightboxDepth: 15.1 }, /lightboxDepth/],
      [{ lightboxEdge: 'medium' }, /lightboxEdge/],
      [{ lightboxMaterial: 'brass' }, /lightboxMaterial/],
      [{ lightboxFront: 'satin' }, /lightboxFront/],
    ]
    for (const [body, problem] of cases) expect(lightboxFieldsError(body, 'image')).toMatch(problem)
  })

  test('only an image may be a lightbox (a missing work counts as not one)', () => {
    expect(lightboxFieldsError({ showLightbox: true }, 'text')).toMatch(/image/)
    expect(lightboxFieldsError({ showLightbox: true }, undefined)).toMatch(/image/)
    // Turning it off is always allowed.
    expect(lightboxFieldsError({ showLightbox: false }, 'text')).toBeNull()
  })

  test('an update keeps what it was not sent', () => {
    expect(lightboxUpdateData({ lightboxDepth: 9, name: 'x' })).toEqual({ lightboxDepth: 9 })
    expect(lightboxUpdateData({})).toEqual({})
  })
})

test.describe('a lightbox has its own box', () => {
  const framed = (overrides: Partial<TArtwork> = {}): TArtwork => ({
    id: 'w1',
    name: 'Work',
    artworkType: 'image',
    imageUrl: 'https://example.com/w1.jpg',
    showFrame: true,
    frameSize: { label: '3', value: 3 },
    showPassepartout: true,
    passepartoutSize: { label: '5', value: 5 },
    showPaperBorder: true,
    paperBorderSize: { label: '1', value: 1 },
    showSupport: true,
    supportThickness: { label: '2', value: 2 },
    ...overrides,
  })

  test('while on, its edge replaces frame + passepartout + paper border on the wall', () => {
    expect(getArtworkBorderCm(framed())).toBe(9)
    expect(getArtworkBorderCm(framed({ showLightbox: true, lightboxEdge: 'wide' }))).toBe(4)
    expect(getArtworkBorderCm(framed({ showLightbox: true, lightboxEdge: 'thin' }))).toBe(1.5)
    expect(getArtworkBorderCm(framed({ showLightbox: true, lightboxEdge: 'none' }))).toBe(0)
    // Not an image: no lightbox, whatever the switch says.
    expect(
      getArtworkBorderCm(framed({ artworkType: 'text', showLightbox: true, lightboxEdge: 'wide' })),
    ).toBe(9)
  })

  test('turning it off brings frame, passepartout, paper border and support back exactly', () => {
    const store = configureStore({ reducer: { artworks: artworksReducer } })
    store.dispatch(createArtwork({ id: 'w1', artworkType: 'image' }))
    const set = <K extends keyof TArtwork>(property: K, value: TArtwork[K]) =>
      store.dispatch(editArtisticImage({ currentArtworkId: 'w1', property, value }))
    const look = framed()
    for (const key of Object.keys(look) as (keyof TArtwork)[])
      if (key !== 'id' && key !== 'name') set(key, look[key])
    const before = structuredClone(store.getState().artworks.byId.w1)

    set('showLightbox', true)
    set('lightboxEdge', 'wide')
    set('lightboxMaterial', 'oak')
    expect(getArtworkBorderCm(store.getState().artworks.byId.w1)).toBe(4)

    set('showLightbox', false)
    const after = store.getState().artworks.byId.w1!
    for (const key of [
      'showFrame',
      'frameSize',
      'showPassepartout',
      'passepartoutSize',
      'showPaperBorder',
      'paperBorderSize',
      'showSupport',
      'supportThickness',
    ] as const)
      expect(after[key], key).toEqual(before![key])
    expect(getArtworkBorderCm(after)).toBe(9)
  })
})

test.describe('a lightbox in the bake', () => {
  const room = (placed: Record<string, unknown>[]) => ({
    exhibition: { spaceId: 'vienna', wallColor: '#ffffff' },
    placed,
    spaceModelVersion: 'vienna.glb?v=1',
    spaceLookVersion: 'look-1',
  })
  const row = {
    artworkId: 'a1',
    wallId: 'w1',
    posX3d: 1,
    showFrame: true,
    artwork: { artworkType: 'image', hiddenFromExhibition: false },
  }

  test('the lightbox columns stale no bake of a room without a lightbox', () => {
    const without = computeBakeFingerprint(room([row]))
    const withColumns = computeBakeFingerprint(room([{ ...row, ...LIGHTBOX_DEFAULTS }]))
    expect(withColumns).toBe(without)
    // Changing a lightbox setting while it is off changes nothing either.
    const offChanged = computeBakeFingerprint(
      room([{ ...row, ...LIGHTBOX_DEFAULTS, lightboxBrightness: 1, lightboxLight: 'warm' }]),
    )
    expect(offChanged).toBe(without)
  })

  test('turning one on, or changing its light, stales the bake', () => {
    const on = { ...row, ...LIGHTBOX_DEFAULTS, showLightbox: true }
    const lit = computeBakeFingerprint(room([on]))
    expect(lit).not.toBe(computeBakeFingerprint(room([row])))
    expect(computeBakeFingerprint(room([{ ...on, lightboxBrightness: 0.9 }]))).not.toBe(lit)
    expect(computeBakeFingerprint(room([{ ...on, lightboxLight: 'cool' }]))).not.toBe(lit)
    expect(computeBakeFingerprint(room([{ ...on, posX3d: 1.2 }]))).not.toBe(lit)
  })

  test('the key a bake records a front under changes with what changes its light', () => {
    const at = { x: 1, y: 1.5, z: -0 }
    const turn = { x: 0, y: -0, z: 0, w: 1 }
    const lightbox = { ...LIGHTBOX_DEFAULTS, showLightbox: true }
    const key = lightboxBakeKey(at, turn, 1.2, 0.8, lightbox)
    // −0 and 0 are the same place.
    expect(key).toBe(lightboxBakeKey({ ...at, z: 0 }, { ...turn, y: 0 }, 1.2, 0.8, lightbox))
    expect(key).not.toMatch(/-0\.0+(?=[,|x]|$)/)
    expect(lightboxBakeKey({ ...at, x: 1.1 }, turn, 1.2, 0.8, lightbox)).not.toBe(key)
    expect(lightboxBakeKey(at, turn, 1.3, 0.8, lightbox)).not.toBe(key)
    for (const change of [
      { lightboxBrightness: 0.6 },
      { lightboxLight: 'warm' as const },
      { lightboxDepth: 8 },
      { lightboxEdge: 'wide' as const },
    ])
      expect(lightboxBakeKey(at, turn, 1.2, 0.8, { ...lightbox, ...change })).not.toBe(key)
    // Its box's material and front don't change its light.
    expect(
      lightboxBakeKey(at, turn, 1.2, 0.8, {
        ...lightbox,
        lightboxMaterial: 'oak',
        lightboxFront: 'glossy',
      }),
    ).toBe(key)
  })

  test('a bake record may list the lightboxes it lit, as strings only', () => {
    const record = {
      id: 'b1',
      fingerprint: 'f',
      bakerVersion: 4,
      unwrapHash: 'hash',
      unwrapStats: [[1, 2, 3, 4, 5]],
      maps: [],
      camera: { exposure: 0.62, whiteBalance: [1, 1, 1] },
      artLight: {},
      bakedAt: '2026-11-15T00:00:00.000Z',
      bakedBy: 'e2e',
      ms: 1,
      reviewedAt: null,
    }
    expect(isBakeRecord(record)).toBe(true)
    expect(isBakeRecord({ ...record, lightboxes: { a1: 'key' } })).toBe(true)
    expect(isBakeRecord({ ...record, lightboxes: { a1: 3 } })).toBe(false)
    expect(isBakeRecord({ ...record, lightboxes: ['a1'] })).toBe(false)
  })

  test('its bloom feed grows with brightness and stays within what the alpha carries', () => {
    const threshold = 16
    expect(lightboxBloomFeed(0, threshold)).toBe(threshold)
    expect(lightboxBloomFeed(0.55, threshold)).toBeGreaterThan(threshold)
    expect(lightboxBloomFeed(1, threshold)).toBeLessThanOrEqual(LIGHTBOX_FEED_MAX)
  })
})
