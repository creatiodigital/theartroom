'use client'

import { useProgress } from '@react-three/drei'
import { useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'

import { useSceneFailed } from '@/components/scene/sceneFailure'
import { track } from '@/lib/analytics/track'
import type { RootState } from '@/redux/store'

type RoomAnalyticsInput = {
  /** Only a visitor's visit counts: never bake, review or a preview link. */
  enabled: boolean
  /** The exhibition's URL slug, as in /exhibitions/<artist>/<slug>/visit. */
  exhibition: string
  /** When the page opened (ms), the start of the load. */
  openedAt: number
  /** The loader has stepped aside: the room is on screen. */
  revealed: boolean
  webglAvailable: boolean | null
  loadError: boolean
  notFound: boolean
  isTouch: boolean
}

/**
 * GA4 events of the 3D room (docs/analytics/README.md), read from the page's own state so the
 * scene itself is untouched:
 * - `room_loaded` (load_ms) once the loader steps aside;
 * - `room_load_abandon` when the visitor leaves before that (elapsed_ms, progress_pct);
 * - `room_error` for WebGL unavailable, a crashed scene, a failed or missing exhibition;
 * - `room_artwork_view` each time Wall View frames a work;
 * - `room_visit_end` once, on leaving: seconds in the room, works framed, details opened.
 */
export const useRoomAnalytics = ({
  enabled,
  exhibition,
  openedAt,
  revealed,
  webglAvailable,
  loadError,
  notFound,
  isTouch,
}: RoomAnalyticsInput) => {
  const sceneFailed = useSceneFailed()
  const inArtworkView = useSelector((state: RootState) => state.scene.inArtworkView)
  const currentArtworkId = useSelector((state: RootState) => state.scene.currentArtworkId)
  const currentSlug = useSelector((state: RootState) =>
    currentArtworkId ? state.artworks.byId[currentArtworkId]?.slug : undefined,
  )
  const detailsOpen = useSelector((state: RootState) => state.dashboard.isArtworkModalOpen)

  // The latest values, for the end of the visit (its effect must not re-run when they change: its
  // cleanup is the visit ending).
  const latest = useRef({ exhibition, openedAt, isTouch })
  useEffect(() => {
    latest.current = { exhibition, openedAt, isTouch }
  }, [exhibition, openedAt, isTouch])

  // What the visit adds up to, read when it ends.
  const visit = useRef({
    revealedAt: 0,
    viewed: new Set<string>(),
    details: 0,
    ended: false,
    failed: false,
  })

  // Failures, once each kind.
  const reason = !enabled
    ? null
    : webglAvailable === false
      ? 'webgl_unavailable'
      : sceneFailed
        ? 'scene_crash'
        : loadError
          ? 'load_error'
          : notFound
            ? 'not_found'
            : null
  useEffect(() => {
    if (!enabled || !revealed || visit.current.revealedAt) return
    visit.current.revealedAt = Date.now()
    // A crashed scene also lifts the loader (for its message): that is not a load.
    if (reason || visit.current.failed) return
    track('room_loaded', {
      exhibition,
      load_ms: visit.current.revealedAt - openedAt,
      touch: isTouch,
    })
  }, [enabled, revealed, reason, exhibition, openedAt, isTouch])

  const reported = useRef(new Set<string>())
  useEffect(() => {
    if (!reason || reported.current.has(reason)) return
    reported.current.add(reason)
    visit.current.failed = true
    track('room_error', { reason, exhibition, touch: isTouch })
  }, [reason, exhibition, isTouch])

  // Wall View framing a work (a click or tap on it).
  useEffect(() => {
    if (!enabled || !inArtworkView || !currentSlug) return
    visit.current.viewed.add(currentSlug)
    track('room_artwork_view', { exhibition, item_id: currentSlug })
  }, [enabled, inArtworkView, currentSlug, exhibition])

  useEffect(() => {
    if (enabled && detailsOpen) visit.current.details += 1
  }, [enabled, detailsOpen])

  // The end of the visit: the tab closing or going elsewhere (pagehide), or the page unmounting
  // (Leave, a link). Before the room was on screen it is an abandoned load. The unmount ends it a
  // tick later, so React's development double mount (unmount, mount again) is not a visit ending.
  const pendingEnd = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    if (!enabled) return
    clearTimeout(pendingEnd.current)
    const end = () => {
      const v = visit.current
      if (v.ended || v.failed) return
      v.ended = true
      const { exhibition: slug, openedAt: start, isTouch: touch } = latest.current
      if (!v.revealedAt) {
        track('room_load_abandon', {
          exhibition: slug,
          elapsed_ms: Date.now() - start,
          progress_pct: Math.round(useProgress.getState().progress),
          touch,
        })
        return
      }
      track('room_visit_end', {
        exhibition: slug,
        seconds: Math.round((Date.now() - v.revealedAt) / 1000),
        works_viewed: v.viewed.size,
        details_opened: v.details,
        touch,
      })
    }
    window.addEventListener('pagehide', end)
    return () => {
      window.removeEventListener('pagehide', end)
      pendingEnd.current = setTimeout(end, 0)
    }
  }, [enabled])
}
