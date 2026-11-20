import { test, expect } from '@playwright/test'

import { photoProblem } from '@/lib/printPresentation/shotCheck'

/**
 * A photo view is refused when the render came out wrong — black (a lost WebGL context draws
 * nothing), or flat (one colour: no paper, no table, no artwork). A refused photo fails the work,
 * which keeps its previous render. Measured on the photo drawn down to a few hundred pixels.
 *
 * Logic only.
 */
test.describe('a photo view that came out wrong is refused', () => {
  test('black', () => {
    expect(photoProblem({ mean: 0, sd: 0 })).toBe('The photo came out black')
    expect(photoProblem({ mean: 12, sd: 3 })).toBe('The photo came out black')
  })

  test('flat: one colour, nothing in it', () => {
    expect(photoProblem({ mean: 240, sd: 0.4 })).toBe('The photo came out flat')
  })

  test('a real photo passes: a white sheet on a white table still has its shadows and grain', () => {
    expect(photoProblem({ mean: 236, sd: 6 })).toBeNull()
    expect(photoProblem({ mean: 120, sd: 45 })).toBeNull()
  })
})
