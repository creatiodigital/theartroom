import { isAnyOf, type UnknownAction } from '@reduxjs/toolkit'

import {
  createArtwork,
  deleteArtwork,
  editArtwork,
  restoreArtwork,
} from '@/redux/slices/artworkSlice'
import {
  addAutofocusGroup,
  createArtworkPosition,
  deleteArtworkPosition,
  redo,
  removeAutofocusGroup,
  setArtworkZOrder,
  toggleArtworkLocked,
  undo,
  updateArtworkPosition,
} from '@/redux/slices/exhibitionSlice'

/**
 * The actions that change what the wall view's Save sends (useSaveExhibition: the artworks batch,
 * the positions, the autofocus groups). questions.md Q142; docs/superpowers/plans/
 * 2026-11-12-wall-unsaved-flag.md, Contract. `editArtisticImage` / `editArtisticText` are
 * `editArtwork`.
 */
export const isWallContentAction = isAnyOf(
  createArtwork,
  restoreArtwork,
  editArtwork,
  deleteArtwork,
  createArtworkPosition,
  updateArtworkPosition,
  deleteArtworkPosition,
  setArtworkZOrder,
  toggleArtworkLocked,
  addAutofocusGroup,
  removeAutofocusGroup,
  undo,
  redo,
)

// convert2DTo3D's keys (wallview/utils.ts): derived from the 2D placement and the wall.
const DERIVED_3D_KEYS = new Set([
  'posX3d',
  'posY3d',
  'posZ3d',
  'quaternionX',
  'quaternionY',
  'quaternionZ',
  'quaternionW',
  'width3d',
  'height3d',
])

// Written by the save itself after an upload (useSaveExhibition), never by an edit.
const SAVE_WRITES = new Set(['imageUrl', 'videoUrl'])

/**
 * Whether `action` is an edit of the wall the server doesn't have yet. Display only: it feeds
 * the left panel's "Unsaved changes" and "Leave site?", nothing else.
 */
export const countsAsWallEdit = (
  action: UnknownAction,
  wall: { isWallView: boolean; editingArtworkId: string | null },
): boolean => {
  // The page load and the 3D editor are not the wall view.
  if (!wall.isWallView || !isWallContentAction(action)) return false

  // The wall's mount-time recompute (Wall.tsx) sends only derived 3D keys; every edit moves,
  // sizes or turns the item in 2D.
  if (updateArtworkPosition.match(action)) {
    return Object.keys(action.payload.artworkPosition).some((key) => !DERIVED_3D_KEYS.has(key))
  }

  if (editArtwork.match(action)) {
    // The View details overlay mirrors its own accepted save while it is open.
    if (wall.editingArtworkId !== null) return false
    return !SAVE_WRITES.has(action.payload.property as string)
  }

  return true
}
