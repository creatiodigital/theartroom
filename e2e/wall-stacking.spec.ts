import { test, expect } from '@playwright/test'

import {
  SHAPE_DEFAULT_ORDER,
  effectiveZOrder,
  layerRankById,
  sortBackToFront,
  zOrderToBack,
  zOrderToFront,
  type LayerItem,
} from '../src/components/wallview/layerOrder'

// Stacking on the 2D wall is decided by zOrder, back to front, with creation
// order breaking ties. `zOrder` stays null until the artist explicitly moves
// something, so an exhibition that predates this feature still stacks the way
// it should: shapes fake a painted section of wall, so they sit behind the
// artworks hung on them.
const shape = (id: string, zOrder?: number | null): LayerItem => ({
  id,
  artworkType: 'shape',
  zOrder,
})
const text = (id: string, zOrder?: number | null): LayerItem => ({ id, artworkType: 'text', zOrder })
const image = (id: string, zOrder?: number | null): LayerItem => ({
  id,
  artworkType: 'image',
  zOrder,
})

const ids = (items: LayerItem[]) => sortBackToFront(items).map((i) => i.id)

test('an untouched shape sits behind content it was created after', () => {
  // The original bug: text first, then the shape painted over it.
  expect(ids([text('caption'), shape('panel')])).toEqual(['panel', 'caption'])
})

test('creation order still decides between two untouched artworks', () => {
  expect(ids([image('first'), text('second')])).toEqual(['first', 'second'])
})

test('creation order still decides between two untouched shapes', () => {
  expect(ids([shape('blue'), shape('red')])).toEqual(['blue', 'red'])
})

test('bringing a shape to the front lifts it above every artwork', () => {
  const wall = [shape('blue'), image('photo'), shape('red')]
  const lifted = [shape('blue'), image('photo'), shape('red', zOrderToFront(wall))]
  expect(ids(lifted)).toEqual(['blue', 'photo', 'red'])
  expect(ids(lifted).at(-1)).toBe('red')
})

test('sending an artwork to the back drops it behind the shapes', () => {
  const wall = [shape('panel'), image('photo')]
  const dropped = [shape('panel'), image('photo', zOrderToBack(wall))]
  expect(ids(dropped)).toEqual(['photo', 'panel'])
})

test('a shape sent back after being brought forward returns behind content', () => {
  const wall = [shape('panel'), text('caption')]
  const forward = [shape('panel', zOrderToFront(wall)), text('caption')]
  expect(ids(forward).at(-1)).toBe('panel')

  const back = [shape('panel', zOrderToBack(forward)), text('caption')]
  expect(ids(back)).toEqual(['panel', 'caption'])
})

test('an untouched shape reports the shape default, an untouched artwork does not', () => {
  expect(effectiveZOrder(shape('panel'))).toBe(SHAPE_DEFAULT_ORDER)
  expect(effectiveZOrder(text('caption'))).toBeGreaterThan(SHAPE_DEFAULT_ORDER)
})

test('an explicit zOrder of zero is honoured, not treated as absent', () => {
  // 0 is falsy — a `||` here would silently send the shape back to -1000.
  expect(effectiveZOrder(shape('panel', 0))).toBe(0)
})

test('ranks run from zero at the back, one per item, for the 3D depth offset', () => {
  const ranks = layerRankById([text('caption'), shape('panel'), image('photo')])
  expect(ranks).toEqual({ panel: 0, caption: 1, photo: 2 })
})
