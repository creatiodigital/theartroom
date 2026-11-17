import { test, expect } from '@playwright/test'
import {
  convertCmText,
  formatDimensions,
  formatDimensionsBoth,
  formatDimensionsRange,
  formatSize,
  parseLengthInput,
} from '../src/lib/units/format'
import { convertSpecRows } from '../src/lib/print-providers/specs'
import { artworkSizeLines, getArtworkSizes } from '../src/lib/editions/artworkSizes'

// docs/public-redesign/units.md: one decimal always, height first, "×", the unit once at the end;
// inches = cm ÷ 2.54 rounded to 0.1.

test.describe('sizes in cm or inches', () => {
  test('a length, in either unit, always to one decimal', () => {
    expect(formatSize(20, 'in')).toBe('7.9 in')
    expect(formatSize(110.5, 'in')).toBe('43.5 in')
    expect(formatSize(40, 'cm')).toBe('40.0 cm')
    expect(formatSize(0.3, 'cm')).toBe('0.3 cm')
  })

  test('a size is written height first', () => {
    expect(formatDimensions(33.3, 22.2, 'in')).toBe('8.7 × 13.1 in')
    expect(formatDimensions(33.3, 22.2, 'cm')).toBe('22.2 × 33.3 cm')
  })

  test('a range names its unit on both ends', () => {
    expect(
      formatDimensionsRange(
        { widthCm: 20, heightCm: 30 },
        { widthCm: 110.5, heightCm: 165.8 },
        'in',
      ),
    ).toBe('11.8 × 7.9 in to 65.3 × 43.5 in')
  })

  test('emails show cm first, inches after', () => {
    expect(formatDimensionsBoth(20, 30)).toBe('30.0 × 20.0 cm (11.8 × 7.9 in)')
  })

  test('legacy spec text', () => {
    // Carts and orders made before the one-decimal rule, or with a derived size at full precision.
    expect(convertCmText('25 × 20 cm', 'cm')).toBe('25.0 × 20.0 cm')
    expect(convertCmText('24.2318698789287 × 36 cm', 'in')).toBe('9.5 × 14.2 in')
    expect(convertCmText('3.0 cm top and bottom, 2.0 cm left and right', 'in')).toBe(
      '1.2 in top and bottom, 0.8 in left and right',
    )
  })

  test('text that only looks like a size is left alone', () => {
    expect(convertCmText('S1 22 x 33', 'in')).toBe('S1 22 x 33')
    expect(convertCmText('Edition of 30', 'both')).toBe('Edition of 30')
  })

  test('both units never nest parentheses', () => {
    expect(convertCmText('Small (≈ 5.0 cm)', 'both')).toBe('Small (≈ 5.0 cm / 2.0 in)')
    expect(convertCmText('30.0 × 20.0 cm', 'both')).toBe('30.0 × 20.0 cm (11.8 × 7.9 in)')
  })

  test('a typed length is read in the chosen unit and kept in cm', () => {
    expect(parseLengthInput('12', 'in')).toBe(30.5)
    expect(parseLengthInput('12,5', 'cm')).toBe(12.5)
    expect(parseLengthInput('abc', 'in')).toBeNull()
    expect(parseLengthInput('0', 'cm')).toBeNull()
  })

  test('spec rows convert their sizes and nothing else', () => {
    const rows = convertSpecRows(
      [
        { id: 'size', label: 'Print size', value: '30.0 × 20.0 cm' },
        { id: 'paper', label: 'Paper', value: 'Hahnemühle German Etching' },
      ],
      'in',
    )
    expect(rows[0].value).toBe('11.8 × 7.9 in')
    expect(rows[1].value).toBe('Hahnemühle German Etching')
  })
})

// Owner, 2026-11-17: an open edition (and an Inquire-only work) shows the range its file prints at;
// a limited edition shows each live variant's print size, one per line.
test.describe('artwork sizes', () => {
  const file = (originalWidth: number | null, originalHeight: number | null) => ({
    originalWidth,
    originalHeight,
  })

  test('an open edition shows the range its file prints at', () => {
    const sizes = getArtworkSizes({ editionType: 'open', ...file(6000, 4000), variants: [] })
    expect(sizes?.kind).toBe('range')
    expect(artworkSizeLines(sizes, 'cm')).toEqual(['20.0 × 30.0 cm to 33.9 × 50.8 cm'])
  })

  test('a limited edition shows each variant size once, smallest first', () => {
    const sizes = getArtworkSizes({
      editionType: 'limited',
      ...file(6000, 4000),
      variants: [
        { widthCm: 40, heightCm: 30 },
        { widthCm: 33.3, heightCm: 22.2 },
        { widthCm: 33.3, heightCm: 22.2 },
      ],
    })
    expect(sizes?.kind).toBe('fixed')
    expect(artworkSizeLines(sizes, 'cm')).toEqual(['22.2 × 33.3 cm', '30.0 × 40.0 cm'])
  })

  test('a limited edition with no live variant falls back to the range', () => {
    const sizes = getArtworkSizes({ editionType: 'limited', ...file(6000, 4000), variants: [] })
    expect(sizes?.kind).toBe('range')
  })

  test('no size line without pixels, or for a file too small to print', () => {
    expect(getArtworkSizes({ editionType: 'open', ...file(null, null), variants: [] })).toBeNull()
    expect(getArtworkSizes({ editionType: 'open', ...file(1000, 800), variants: [] })).toBeNull()
    expect(artworkSizeLines(null, 'cm')).toEqual([])
  })
})
