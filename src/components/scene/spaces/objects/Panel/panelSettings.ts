import { Box3, Matrix4, Vector3 } from 'three'
import type { Mesh } from 'three'

import { worldMatrixOf } from '@/components/scene/spaces/objects/nodeIndices'

/**
 * Display panels — thin freestanding walls the artist places in the room.
 *
 * A panel is three nodes in the GLB: the box (`panel0`) and its two hangable
 * faces (`panelFront0`, `panelBack0`). The faces are ordinary placeholders, so
 * once one is open it behaves like any other wall in the 2D editor.
 *
 * Indices run in blocks of ten, one block per room — room 0 uses 0–9, room 1
 * uses 10–19. Gaps are free (`getNodeIndices` only collects what it finds), and
 * blocks mean adding a panel to one room never renumbers another. That matters
 * because `wallId` is persisted per artwork as `panelFront0`: renumbering a
 * panel would orphan everything hung on it.
 */
export const PANEL_DEFAULT_COLOR = '#ffffff'

export type PanelSettings = {
  enabled?: boolean
  /** Offset from the panel's Blender position, in metres. */
  x?: number
  z?: number
  /** Rotation about the panel's own center, in degrees. */
  rotationY?: number
  color?: string
}

const PANEL_FACE = /^panel(?:Front|Back)(\d+)$/

/**
 * The panel a face belongs to, or null if this wall is not a panel face.
 *
 * `panel0` itself returns null — the box is not hangable, only its two faces are.
 */
export const panelIndexOfFace = (wallId: string | null | undefined): number | null => {
  if (!wallId) return null
  const match = PANEL_FACE.exec(wallId)
  return match ? Number(match[1]) : null
}

/**
 * Panels are off until switched on.
 *
 * Deliberately the opposite of the track lamps, which default to lit. An
 * exhibition built before panels existed has no settings for them, and it must
 * not suddenly grow a six-metre wall through the middle of the room.
 */
export const isPanelEnabled = (settings?: PanelSettings): boolean => settings?.enabled ?? false

export const panelColorOf = (settings?: PanelSettings): string =>
  settings?.color ?? PANEL_DEFAULT_COLOR

/**
 * The panel's transform, as one matrix.
 *
 * This is the single source every consumer reads: the 3D group that draws the
 * box and its faces, `useBoundingData` when it maps the 2D canvas onto a face,
 * and `ArtObjects` when it places the artworks hanging on it. Move the panel and
 * all three follow, because there is only one answer to follow.
 *
 * Rotation is applied about `pivot` — the panel's own center — and the move
 * after it, so dragging a rotated panel still puts it exactly where asked.
 */
export const panelMatrix = (
  settings: PanelSettings | undefined,
  pivot: readonly [number, number, number],
): Matrix4 => {
  const radians = ((settings?.rotationY ?? 0) * Math.PI) / 180

  return new Matrix4()
    .makeTranslation(settings?.x ?? 0, 0, settings?.z ?? 0)
    .multiply(new Matrix4().makeTranslation(pivot[0], pivot[1], pivot[2]))
    .multiply(new Matrix4().makeRotationY(radians))
    .multiply(new Matrix4().makeTranslation(-pivot[0], -pivot[1], -pivot[2]))
}

/**
 * The world-space center of a panel's box — the point it rotates about.
 *
 * Shared rather than computed per consumer: the 3D group and `useBoundingData`
 * must rotate about the SAME point, or the faces would swing away from the box
 * they belong to.
 *
 * `worldMatrixOf` because panel nodes are world-baked — their ancestor
 * transforms were collapsed into them at load, so their own matrix is already
 * the world one.
 */
export const panelBox = (panelNode: Mesh): Box3 => {
  if (!panelNode.geometry.boundingBox) panelNode.geometry.computeBoundingBox()
  return panelNode.geometry.boundingBox!.clone().applyMatrix4(worldMatrixOf(panelNode))
}

export const panelPivot = (panelNode: Mesh): [number, number, number] => {
  const center = panelBox(panelNode).getCenter(new Vector3())
  return [center.x, center.y, center.z]
}

/**
 * Where a panel meets the floor, for its contact shadow.
 *
 * Read off the same baked box as the pivot, in the panel's own pre-transform
 * space — the group's matrix then carries the shadow along with everything
 * else, so it never slides out from under the panel.
 *
 * `width`/`depth` come from the axis-aligned box, which is exact for a panel
 * authored square to the axes and slightly generous for one authored at an
 * angle in Blender.
 */
export const panelFootprint = (
  panelNode: Mesh,
): { center: [number, number, number]; width: number; depth: number; baseY: number } => {
  const box = panelBox(panelNode)
  const center = box.getCenter(new Vector3())
  const size = box.getSize(new Vector3())
  return {
    center: [center.x, box.min.y, center.z],
    width: size.x,
    depth: size.z,
    baseY: box.min.y,
  }
}
