import type { TArtworkKind } from '@/types/artwork'

/**
 * Stacking order for items on a wall, in 2D and in 3D.
 *
 * Every item carries a `zOrder`. It stays `null` until the artist explicitly
 * moves something with "move to front" / "move to back", so an exhibition that
 * predates this feature keeps stacking sensibly with nothing written to it:
 * shapes fake a painted section of the wall, so an untouched shape falls back
 * to a default well behind an untouched artwork.
 *
 * That default is only a starting point, never a rule — once an artist moves a
 * shape forward it can sit above anything, which is what makes a red circle on
 * a blue rectangle possible.
 *
 * Ties are broken by creation order, which callers supply by passing items in
 * `allIds` order. `Array.prototype.sort` is stable (ES2019), so that ordering
 * survives the sort untouched.
 */
export const SHAPE_DEFAULT_ORDER = -1000
export const CONTENT_DEFAULT_ORDER = 0

export type LayerItem = {
  id: string
  artworkType?: TArtworkKind
  zOrder?: number | null
}

/**
 * The order an item actually stacks at: its own `zOrder` when the artist has
 * set one, otherwise the default for its kind.
 *
 * Uses `??` deliberately — an explicit `zOrder` of 0 is a real position and
 * must not fall through to the default the way `||` would let it.
 */
export const effectiveZOrder = (item: LayerItem): number =>
  item.zOrder ?? (item.artworkType === 'shape' ? SHAPE_DEFAULT_ORDER : CONTENT_DEFAULT_ORDER)

/** Items back to front. Pass them in creation order so ties resolve by age. */
export const sortBackToFront = <T extends LayerItem>(items: T[]): T[] =>
  [...items].sort((a, b) => effectiveZOrder(a) - effectiveZOrder(b))

/**
 * Rank per id, 0 = backmost. Drives the 3D depth offset: coplanar meshes on the
 * same wall z-fight, so each one is nudged off the wall by its rank.
 */
export const layerRankById = (items: LayerItem[]): Record<string, number> => {
  const ranks: Record<string, number> = {}
  sortBackToFront(items).forEach((item, rank) => {
    ranks[item.id] = rank
  })
  return ranks
}

/** A `zOrder` that puts an item in front of everything currently on the wall. */
export const zOrderToFront = (items: LayerItem[]): number =>
  items.length === 0 ? CONTENT_DEFAULT_ORDER + 1 : Math.max(...items.map(effectiveZOrder)) + 1

/** A `zOrder` that puts an item behind everything currently on the wall. */
export const zOrderToBack = (items: LayerItem[]): number =>
  items.length === 0 ? SHAPE_DEFAULT_ORDER - 1 : Math.min(...items.map(effectiveZOrder)) - 1

/**
 * Every item on the 2D wall renders at this same z-index; the real stacking is
 * done by DOM order, which `Wall` emits back to front via `sortBackToFront`.
 *
 * Kept explicit rather than dropped so items stay above the floor-level
 * indicator and the scale figures, which also sit at 1 but are emitted first.
 *
 * Selection deliberately does NOT raise an item. Lifting the selected item was
 * how a selected shape used to swallow every text sitting on it; with move to
 * front / move to back available, the artist controls the order instead.
 */
export const WALL_ITEM_Z_INDEX = 1

/**
 * How far apart, in metres, consecutive ranks sit in 3D.
 *
 * `convert2DTo3D` snaps every item flat onto the wall's front face, so two
 * items on one wall are coplanar and their meshes z-fight — flickering that
 * changes with the viewing angle. Text escapes this today only because
 * `Stencil` nudges its glyphs 0.3 mm off the card; shapes have no such nudge,
 * which is what would make a circle on a rectangle flicker.
 *
 * Pushing each item off the wall by its rank resolves the depth properly and
 * keeps 3D agreeing with the 2D canvas. Half a millimetre per step is far
 * below anything visible at gallery viewing distance, and only the relative
 * order matters, so even a densely hung wall stays flat to the eye.
 */
export const LAYER_DEPTH_STEP = 0.0005
