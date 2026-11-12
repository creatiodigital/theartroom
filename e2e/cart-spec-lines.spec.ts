import { test, expect } from '@playwright/test'

import { specLines, specShortLine } from '../src/lib/cart/specLines'

/**
 * The cart's and checkout's short spec lines (order-flow.md "Cart"). Node only: no page, no sign-in.
 * The rule that matters most: every row of the snapshot shows up somewhere.
 */

const row = (id: string, label: string, value: string) => ({ id, label, value })

test.describe('specLines', () => {
  test('an unframed open edition reads as the three drawn lines', () => {
    expect(
      specLines([
        row('printType', 'Print type', 'Giclée'),
        row('paper', 'Paper', 'Hahnemühle German Etching'),
        row('sheet', 'Sheet size', '33.0 × 28.0 cm'),
        row('size', 'Print size', '25.0 × 20.0 cm'),
        row('border', 'Paper border', '4 cm'),
        row('format', 'Mounting / Framing', 'Print Only'),
      ]),
    ).toEqual([
      'Giclée on Hahnemühle German Etching',
      '25.0 × 20.0 cm print · 4 cm border · sheet 33.0 × 28.0 cm',
      'Print only, no frame',
    ])
  })

  test('a framed print names the frame, then lists the rest, one labelled line each', () => {
    expect(
      specLines([
        row('printType', 'Print type', 'Giclée'),
        row('paper', 'Paper', 'Hahnemühle Photo Rag'),
        row('size', 'Print size', '40.0 × 30.0 cm'),
        row('border', 'Paper border', '—'),
        row('format', 'Mounting / Framing', 'Framing'),
        row('frameType', 'Frame type', 'Standard Frame'),
        row('moulding', 'Molding', 'Oak — Thin'),
        row('glass', 'Glass', 'Anti Reflective Art'),
        row('hanging', 'Hanging', 'D-Rings & Cord'),
      ]),
    ).toEqual([
      'Giclée on Hahnemühle Photo Rag',
      '40.0 × 30.0 cm print · no border',
      'Standard Frame, Oak — Thin',
      'Glass: Anti Reflective Art',
      'Hanging: D-Rings & Cord',
    ])
  })

  test('unequal borders keep their own wording', () => {
    expect(
      specLines([row('border', 'Paper border', '6 cm top and bottom, 4 cm left and right')]),
    ).toEqual(['border 6 cm top and bottom, 4 cm left and right'])
  })

  test('rows it does not know are never dropped', () => {
    const lines = specLines([
      row('printType', 'Print type', 'Giclée'),
      row('frame', 'Frame', 'Oak'),
      row('glazing', 'Glazing', 'Museum glass'),
    ])
    expect(lines).toEqual(['Giclée', 'Frame: Oak', 'Glazing: Museum glass'])
  })

  test('the mount carries its size on one line', () => {
    expect(
      specLines([
        row('windowMount', 'Mount (Passepartout)', 'Off White'),
        row('windowMountSize', 'Mount (Passepartout) Size', 'Small (≈ 5 cm)'),
        row('hanging', 'Hanging', 'Mirror Plates'),
      ]),
    ).toEqual(['Mount (Passepartout): Off White, Small (≈ 5 cm)', 'Hanging: Mirror Plates'])
  })

  test('every value of every row appears in the lines', () => {
    const specs = [
      row('printType', 'Print type', 'C-Type'),
      row('paper', 'Paper', 'Fuji Matt'),
      row('size', 'Print size', '20.0 × 30.0 cm'),
      row('border', 'Paper border', '3 cm'),
      row('format', 'Mounting / Framing', 'Framing'),
      row('frameType', 'Frame type', 'Box Frame'),
      row('moulding', 'Molding', 'Black — Square'),
      row('glass', 'Glass', 'Standard'),
      row('windowMount', 'Mount (Passepartout)', 'Off White'),
      row('windowMountSize', 'Mount (Passepartout) Size', 'Small (≈ 5 cm)'),
      row('hanging', 'Hanging', 'Mirror Plates'),
    ]
    const text = specLines(specs).join('\n')
    for (const spec of specs.filter((s) => s.id !== 'format')) expect(text).toContain(spec.value)
  })

  test('nothing configured, no lines', () => {
    expect(specLines([])).toEqual([])
  })

  test('the short line is the size and how it is presented', () => {
    const base = [row('paper', 'Paper', 'Fuji Matt'), row('size', 'Print size', '25.0 × 20.0 cm')]
    expect(specShortLine([...base, row('format', 'Mounting / Framing', 'Print Only')])).toBe(
      '25.0 × 20.0 cm · print only',
    )
    expect(
      specShortLine([
        ...base,
        row('format', 'Mounting / Framing', 'Framing'),
        row('frameType', 'Frame type', 'Box Frame'),
      ]),
    ).toBe('25.0 × 20.0 cm · Box Frame')
    expect(specShortLine([row('size', 'Print size', '30.0 × 40.0 cm')])).toBe('30.0 × 40.0 cm')
  })
})
