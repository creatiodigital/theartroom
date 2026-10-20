import type { Object3D } from 'three'

import type { BakeRecord } from '@/lib/bake/bakeRecord'
import { requestRoomRecapture } from '@/components/scene/RoomEnvironmentCapture'

import {
  applyBakedLighting,
  artLightById,
  type BakedMapTexture,
  type PlasterTextures,
} from './applyBake'
import { BAKE_DEBUG } from './bakedLook'
import { setMeteredExposure, setMeteredWhiteBalance } from './bakeState'
import { brightenWindows } from './daylight'
import { unwrapMatches } from './hashUnwrap'
import { prepareReceivers, type RoomPaint } from './receivers'

/**
 * ⚠️ AR-161 — a stored bake onto the room: what the admin's review and every visitor run (no
 * baking here, and nothing from `LightBaker` — visitors only apply). Everything the live bake
 * puts on the room besides the maps comes through the same shared code: the unwrap
 * (`prepareReceivers`), the window daylight (`brightenWindows`), the material swap
 * (`applyBakedLighting`), then the bake's camera and a fresh room capture.
 */

export type StoredBakeResult =
  | {
      ok: true
      undo: () => void
      /** Every frame while it's on: artworks that mount later get their patches too. */
      updateArtworks: () => void
      unwrap: 'exact' | 'tolerant'
    }
  | {
      ok: false
      reason: 'unwrap-mismatch' | 'apply-failed'
      error?: unknown
      detail?: Record<string, unknown>
    }

/**
 * Applies `bake` (its maps already decoded, in `maps`) to the room. The maps fit only the unwrap
 * they were baked into: when this room's unwrap no longer matches, nothing is applied (`ok: false`
 * — never a misaligned bake). A throw midway is undone the same way. `room`: the artist's wall
 * and ceiling colors and the space's look, as the bake took them (the receivers' albedo, the
 * window daylight).
 * On success, `undo` puts back every change.
 */
export const applyStoredBake = (
  scene: Object3D,
  bake: BakeRecord,
  maps: BakedMapTexture[],
  plaster: PlasterTextures | null,
  room: RoomPaint,
): StoredBakeResult => {
  const undos: (() => void)[] = []
  // Last change first.
  const undo = () =>
    undos
      .splice(0)
      .reverse()
      .forEach((step) => step())
  try {
    // Before the first frame the meshes' world matrices may not be current yet; the unwrap is
    // laid out in world space.
    scene.updateMatrixWorld()
    const prepared = prepareReceivers(scene, room)
    undos.push(prepared.restore)
    const unwrap = unwrapMatches(
      { hash: bake.unwrapHash, stats: bake.unwrapStats },
      { hash: prepared.unwrapHash, stats: prepared.unwrapStats },
    )
    if (unwrap === 'mismatch') {
      undo()
      return {
        ok: false,
        reason: 'unwrap-mismatch',
        detail: { stored: bake.unwrapHash, local: prepared.unwrapHash },
      }
    }
    if (BAKE_DEBUG && unwrap === 'tolerant')
      console.info(
        '[AR-161 unwrap] tolerant match',
        JSON.stringify({ stored: bake.unwrapHash, local: prepared.unwrapHash }),
      )
    undos.push(brightenWindows(scene, room.look.daylightGain).undo)
    // The light the bake measured at each artwork, found by the artwork's id.
    const baked = applyBakedLighting(
      scene,
      prepared.receivers,
      maps,
      plaster,
      artLightById(bake.artLight),
    )
    undos.push(baked.undo)
    // The space's fixed camera, as recorded with the bake.
    setMeteredExposure(bake.camera.exposure)
    undos.push(() => setMeteredExposure(null))
    setMeteredWhiteBalance(bake.camera.whiteBalance)
    undos.push(() => setMeteredWhiteBalance(null))
    // The room the environment captured a moment ago no longer exists.
    requestRoomRecapture()
    return { ok: true, undo, updateArtworks: baked.updateArtworks, unwrap }
  } catch (error) {
    undo()
    return { ok: false, reason: 'apply-failed', error }
  }
}
