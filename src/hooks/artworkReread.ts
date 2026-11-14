'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useSelector, useStore } from 'react-redux'
import type { UnknownAction } from '@reduxjs/toolkit'

import { selectWallUnsaved } from '@/redux/selectors/wallUnsaved'
import { editArtwork } from '@/redux/slices/artworkSlice'
import type { RootState } from '@/redux/store'
import type { TArtwork } from '@/types/artwork'

/**
 * The 3D editor's re-read of works the artist opened in the studio with "Edit artwork"
 * (questions.md Q139 a, Q153; docs/superpowers/plans/2026-11-12-later-pass.md, "Addition (Q153)").
 *
 * The wall's Save writes each work's details from the editor's own copy, so a copy older than a
 * studio save would put the old values back. When the editor's tab is in front again, each such
 * work is read (GET only, nothing is ever sent) and compared on the fields the wall view's
 * overlay mirrors after its own save. A difference is applied, unless a wall is open with unsaved
 * changes: then it is held, the left panel says so, and it is applied once the wall is saved or
 * discarded. The wall's save itself first takes the studio's values for every field but a text
 * item's text (Q157 a, `takeStudioValuesForSave`).
 */

/** The details the studio edits, as the store names them and as `GET /api/artworks/{id}` does. */
export const REREAD_FIELDS = [
  { property: 'artworkTitle', server: 'title' },
  { property: 'author', server: 'author' },
  { property: 'artworkYear', server: 'year' },
  { property: 'artworkDimensions', server: 'dimensions' },
  { property: 'technique', server: 'technique' },
  { property: 'description', server: 'description' },
  { property: 'textContent', server: 'textContent' },
  // AR-182: the text's second version, a wall field as the text is.
  { property: 'textContentSecond', server: 'textContentSecond' },
  { property: 'featured', server: 'featured' },
  { property: 'imageUrl', server: 'imageUrl' },
] as const

type RereadProperty = (typeof REREAD_FIELDS)[number]['property']
export type ServerArtwork = Partial<Record<(typeof REREAD_FIELDS)[number]['server'], unknown>>
export type RereadPatch = Partial<Pick<TArtwork, RereadProperty>>

/**
 * The fields a wall Save keeps from the wall's copy: a text item's words, which the wall edits
 * (Q157), in English and (AR-182) its second version.
 */
const WALL_FIELDS = ['textContent', 'textContentSecond'] as const
type WallField = (typeof WALL_FIELDS)[number]
const isWallField = (property: string) => (WALL_FIELDS as readonly string[]).includes(property)
/** The studio's values a wall Save sends: every field but those. */
export type StudioValues = Partial<Pick<TArtwork, Exclude<RereadProperty, WallField>>>

// As the page load stores them (lib/exhibitionArtworkMapper.ts mapToArtwork): text `|| undefined`,
// featured `?? false`.
const storedValue = (property: RereadProperty, value: unknown) =>
  property === 'featured' ? Boolean(value ?? false) : (value as string | null) || undefined

// Compared alike: no text, null and '' are the same; featured as a boolean.
const comparable = (property: RereadProperty, value: unknown) =>
  property === 'featured' ? Boolean(value) : typeof value === 'string' ? value : ''

/** The fields whose saved value differs from the store's copy, as they should be stored. */
export const artworkDetailsPatch = (
  current: TArtwork | undefined,
  server: ServerArtwork,
): RereadPatch => {
  const patch: Record<string, unknown> = {}
  for (const { property, server: field } of REREAD_FIELDS) {
    const next = storedValue(property, server[field])
    if (comparable(property, current?.[property]) !== comparable(property, next)) {
      patch[property] = next
    }
  }
  return patch as RereadPatch
}

/** The studio's values for every field but a text item's text, as the store keeps them. */
export const studioValuesOf = (server: ServerArtwork): StudioValues => {
  const values: Record<string, unknown> = {}
  for (const { property, server: field } of REREAD_FIELDS) {
    if (!isWallField(property)) values[property] = storedValue(property, server[field])
  }
  return values as StudioValues
}

/** The writes that bring the store's copy to the saved one, tagged so they never count as edits. */
export const rereadActions = (artworkId: string, patch: RereadPatch): UnknownAction[] =>
  Object.entries(patch).map(([property, value]) => ({
    ...editArtwork({
      currentArtworkId: artworkId,
      property: property as RereadProperty,
      value: value as TArtwork[RereadProperty],
    }),
    meta: { fromServer: true },
  }))

// ---- Session state (display only, never sent) ----

/** Works sent to the studio by "Edit artwork" since the editor opened. */
const opened = new Set<string>()
/** Works whose saved details differ, held while the open wall has unsaved changes. */
const held = new Set<string>()
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

/** Whether a work is held for the open wall (the left panel's line). */
export const hasHeldWorks = () => held.size > 0

/** "Edit artwork" opened this work in the studio: re-read it when the editor is back in front. */
export const rereadWhenBack = (artworkId: string) => {
  opened.add(artworkId)
}

/** Forget the session (the editor unmounted); also what the spec starts from. */
export const resetArtworkReread = () => {
  opened.clear()
  held.clear()
  notify()
}

type RereadStore = {
  getState: () => Pick<RootState, 'artworks' | 'wallView'>
  dispatch: (action: UnknownAction) => unknown
}
type FetchArtwork = (artworkId: string) => Promise<ServerArtwork | null>

const fetchSavedArtwork: FetchArtwork = async (artworkId) => {
  try {
    const response = await fetch(`/api/artworks/${artworkId}`, { cache: 'no-store' })
    return response.ok ? ((await response.json()) as ServerArtwork) : null
  } catch {
    return null
  }
}

/**
 * Re-read every opened work and apply, or hold, what differs. Decided from the store as it is when
 * each reply arrives. A failed read changes nothing.
 */
export const rereadOpenedWorks = async (
  store: RereadStore,
  fetchArtwork: FetchArtwork = fetchSavedArtwork,
) => {
  for (const artworkId of [...opened]) {
    const server = await fetchArtwork(artworkId)
    if (!server) continue
    const state = store.getState()
    const patch = artworkDetailsPatch(state.artworks.byId[artworkId], server)
    if (!(state.wallView.isWallView && selectWallUnsaved(state))) {
      rereadActions(artworkId, patch).forEach((action) => store.dispatch(action))
      held.delete(artworkId)
    } else if (Object.keys(patch).some((property) => !isWallField(property))) {
      held.add(artworkId)
    } else {
      // Held only for what a wall Save loads (Q157): a text alone keeps the wall's copy, and is
      // most often the wall's own unsaved edit, not a change made in another tab.
      held.delete(artworkId)
    }
  }
  notify()
}

/**
 * Q157 (a), before every wall save that sends the artworks batch (useSaveExhibition: Save, Save &
 * close, View details' save-first). Each work opened with "Edit artwork" is read again, not only
 * the held ones: a click on Save in the editor's window while it is behind fires its focus and the
 * click together, so the focus re-read can't have held the work yet. The studio's values for every
 * field but a text item's text go into the store (tagged, so no dot) and are returned for the
 * request, which is built from the render's copy. All or nothing: `null` when a read fails, and
 * the save then stops before anything is sent. Afterwards no work is held, so the line goes.
 */
export const takeStudioValuesForSave = async (
  dispatch: RereadStore['dispatch'],
  fetchArtwork: FetchArtwork = fetchSavedArtwork,
): Promise<Record<string, StudioValues> | null> => {
  const artworkIds = [...opened]
  if (artworkIds.length === 0) return {}
  const servers = await Promise.all(artworkIds.map((artworkId) => fetchArtwork(artworkId)))
  if (servers.some((server) => !server)) return null

  const values: Record<string, StudioValues> = {}
  artworkIds.forEach((artworkId, index) => {
    values[artworkId] = studioValuesOf(servers[index] as ServerArtwork)
    rereadActions(artworkId, values[artworkId]).forEach((action) => dispatch(action))
    held.delete(artworkId)
  })
  notify()
  return values
}

/**
 * Mounted once by the editor (EditView). Re-reads on the tab's return (window focus), when the
 * wall closes (Save & close, Cancel) and when its Unsaved dot clears (an accepted Save).
 */
export const useArtworkRereadOnReturn = () => {
  const store = useStore<RootState>()
  const isWallView = useSelector((state: RootState) => state.wallView.isWallView)
  const unsaved = useSelector(selectWallUnsaved)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const previous = useRef({ isWallView, unsaved })

  // One at a time: a trigger arriving mid-read runs after it.
  const reread = useRef(() => {
    if (opened.size === 0) return
    queue.current = queue.current.then(() => rereadOpenedWorks(store))
  })

  useEffect(() => {
    const onFocus = () => reread.current()
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      resetArtworkReread()
    }
  }, [])

  useEffect(() => {
    const wallClosed = previous.current.isWallView && !isWallView
    const dotCleared = isWallView && previous.current.unsaved && !unsaved
    previous.current = { isWallView, unsaved }
    if (wallClosed || dotCleared) reread.current()
  }, [isWallView, unsaved])
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Whether a work opened in the studio is waiting for this wall to be saved or discarded. */
export const useArtworkChangedElsewhere = (): boolean =>
  useSyncExternalStore(subscribe, hasHeldWorks, () => false)
