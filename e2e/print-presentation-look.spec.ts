import { test, expect } from '@playwright/test'

import { makeLook, seedForArtwork } from '@/lib/printPresentation/look'
import { presentationInputs, type PresentationSource } from '@/lib/printPresentation/inputs'

/**
 * Print presentations: the approved look is frozen. Each artwork's seed, and every value the
 * seeded generator draws from it, must stay exactly as the owner approved them (2026-10-28; the
 * same day, the unframed sheet's shadow was made crisper: half the softness, same draw).
 * Pure module checks: no server, no WebGL.
 */

// makeLook's output for two real artworks, captured from the approved spike before it moved.
const PINNED_LIMITED = {
  key: [-1.042328032827936, 1.7257278620731087, 2.4],
  keyShare: 0.09784427749924363,
  fills: [
    { position: [0.021521580708213167, -1.5921578392619267, 2.4], share: 0.01837519744411111 },
    { position: [1.3369788514450192, 0.1722997116856277, 2.4], share: 0.011196241974830627 },
  ],
  softness: 114.55437851138413,
  standoff: 0.006724045697133988,
  setBack: 0.01939431713661179,
  cornerLift: [
    0.00047067875498905774, 0.0017415393525734544, 0.0030154601901303977, 0.0002958417300134897,
  ],
  edgeLift: 0.00033800776805728675,
  woodOffset: [0.1660285508260131, 0.060766864102333784],
  woodTileM: 0.32024389155209065,
  copy: 7,
  barOffsets: [
    [0.7673468645662069, 0.9414708772674203],
    [0.2670107623562217, 0.5384989837184548],
    [0.5521780455019325, 0.03374696569517255],
    [0.82338389265351, 0.17377308919094503],
  ],
}
const PINNED_FRAMED = {
  key: [-0.7781678321305662, 1.4505426285555587, 2.4],
  keyShare: 0.10620018609799445,
  fills: [
    { position: [0.7662123689660802, -1.4779655253048984, 2.4], share: 0.013399161086417734 },
    { position: [1.5178167891455814, 0.6654554258100689, 2.4], share: 0.012993354042991996 },
  ],
  softness: 239.86578326672316,
  standoff: 0.002092095082625747,
  setBack: 0.020809118365868927,
  cornerLift: [
    0.0010414601217024028, 0.0006395050982013344, 0.002239076836616732, 0.0011926186982542275,
  ],
  edgeLift: 0.0001681705541908741,
  woodOffset: [0.07825035252608359, 0.7874996587634087],
  woodTileM: 0.30370387219823897,
  copy: 42,
  barOffsets: [
    [0.06048554158769548, 0.4556464394554496],
    [0.6318723252043128, 0.8558956172782928],
    [0.8648354664910585, 0.8422931639943272],
    [0.14614496333524585, 0.5220009747426957],
  ],
}

const source = (patch: Partial<PresentationSource> = {}): PresentationSource => ({
  id: '683e76c1-2c50-4ed0-93d1-444fa8edef7f',
  artworkType: 'image',
  originalWidth: 6240,
  originalHeight: 4160,
  printEnabled: true,
  editionType: 'open',
  firstVariantEditionSize: null,
  ...patch,
})

test.describe('print presentation look', () => {
  test('each artwork keeps its own seed', () => {
    expect(seedForArtwork('683e76c1-2c50-4ed0-93d1-444fa8edef7f')).toBe(1133590978)
    expect(seedForArtwork('b30d64e2-4b49-418a-8b06-f25c20f22b6b')).toBe(2812886702)
  })

  test('the seeded look is exactly the approved one', () => {
    expect(makeLook(1133590978, 'limited', 50)).toEqual(PINNED_LIMITED)
    expect(makeLook(2812886702, 'framed', 50)).toEqual(PINNED_FRAMED)
  })

  test('the pencilled copy number is always one of the edition', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { copy } = makeLook(seed, 'limited', 25)
      expect(copy).toBeGreaterThanOrEqual(1)
      expect(copy).toBeLessThanOrEqual(25)
    }
  })
})

test.describe('print presentation inputs', () => {
  test('an open edition is framed, with no edition number', () => {
    const inputs = presentationInputs(source())
    expect(inputs?.mode).toBe('framed')
    expect(inputs?.edition).toBeNull()
  })

  test('a limited edition for sale with a size is a numbered sheet', () => {
    const inputs = presentationInputs(
      source({ editionType: 'limited', firstVariantEditionSize: 50 }),
    )
    expect(inputs?.mode).toBe('limited')
    expect(inputs?.edition).toBe(50)
  })

  test('a limited edition not for sale yet is framed', () => {
    const inputs = presentationInputs(
      source({ editionType: 'limited', firstVariantEditionSize: 50, printEnabled: false }),
    )
    expect(inputs?.mode).toBe('framed')
    expect(inputs?.edition).toBeNull()
  })

  test('a limited edition with no size yet is framed', () => {
    expect(presentationInputs(source({ editionType: 'limited' }))?.mode).toBe('framed')
  })

  test('only images with known dimensions get a presentation', () => {
    expect(presentationInputs(source({ artworkType: 'video' }))).toBeNull()
    expect(presentationInputs(source({ originalWidth: null }))).toBeNull()
    expect(presentationInputs(source({ originalHeight: 0 }))).toBeNull()
  })

  test("the ratio is width over height to 4 decimals, and the seed is the artwork's", () => {
    const inputs = presentationInputs(source({ originalWidth: 3636, originalHeight: 3880 }))
    expect(inputs?.ratio).toBe(0.9371)
    expect(inputs?.seed).toBe(1133590978)
  })

  test('the fingerprint follows ratio, mode and edition size, and nothing else', () => {
    const base = presentationInputs(source())!.fingerprint
    expect(presentationInputs(source())!.fingerprint).toBe(base)
    expect(presentationInputs(source({ originalWidth: 6000 }))!.fingerprint).not.toBe(base)
    const limited = presentationInputs(
      source({ editionType: 'limited', firstVariantEditionSize: 50 }),
    )!.fingerprint
    expect(limited).not.toBe(base)
    expect(
      presentationInputs(source({ editionType: 'limited', firstVariantEditionSize: 30 }))!
        .fingerprint,
    ).not.toBe(limited)
  })

  test('panoramas and tall works are accepted', () => {
    expect(presentationInputs(source({ originalWidth: 4000, originalHeight: 1000 }))?.ratio).toBe(4)
    expect(presentationInputs(source({ originalWidth: 1000, originalHeight: 4000 }))?.ratio).toBe(
      0.25,
    )
  })
})
