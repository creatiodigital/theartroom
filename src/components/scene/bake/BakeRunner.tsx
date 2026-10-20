'use client'

import { useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { useFrame, useThree } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import type { Color, Mesh } from 'three'

import type { BakeRecord } from '@/lib/bake/bakeRecord'
import { saveBake } from '@/lib/bake/bakeUpload'
import type { SpaceCamera } from '@/lib/bake/spaceLooks'
import type { RootState } from '@/redux/store'
import { useBakedDimmer } from '@/components/scene/spaces/objects/useLampDimmer'

import { BAKE_DEBUG, setBakeAllRooms, useBakedLook } from './bakedLook'
import { BakeWait, bakeFraction, bakeSlice, logBake, startBake, type StartedBake } from './bakeJob'
import { buildBakeDraft, encodeBakeMaps } from './bakeOutput'
import { supportsBaking } from './bakeSupport'
import { bakeCamera, meterBake } from './meter'
import { measureArtLight } from './receivers'

/**
 * ⚠️ AR-161 — the admin's bake (the visit page's bake mode, `?bake=1`). Bakes this room on the
 * admin's machine in its space's approved look (`bakeJob.ts`), then stores it: every map encoded
 * to its PNG and uploaded, then the draft record saved (`saveBake`). Nothing goes on the room: the
 * admin looks at the stored bake in review, exactly as visitors will get it.
 *
 * All or nothing: a failure anywhere, or the page going away (unmount aborts every request),
 * saves nothing — the exhibition keeps the draft bake it had.
 */

export interface BakeRunnerProgress {
  /** `baking`: the light (minutes); `saving`: encoding and uploading the maps (seconds). */
  phase: 'baking' | 'saving'
  /** 0..1 within the phase. */
  fraction: number
}

export interface BakeRunnerProps {
  exhibitionId: string
  /**
   * The room's fingerprint when this page loaded (`bakeFingerprint`): the bake is saved as a bake
   * of that room, so an artist saving during the bake makes it stale on arrival.
   */
  fingerprint: string
  spaceId: string
  onProgress: (progress: BakeRunnerProgress) => void
  /** The bake is stored (the saved record, `reviewedAt: null`). */
  onDone: (bake: BakeRecord) => void
  /** Nothing was saved. */
  onError: (error: Error) => void
}

/** Encoding the maps' share of the saving phase; the uploads and the record are the rest. */
const ENCODE_SHARE = 0.3

type Phase = 'waiting' | 'baking' | 'saving' | 'done' | 'failed'

export const BakeRunner = (props: BakeRunnerProps) => {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const wallColor = useSelector((state: RootState) => state.exhibition.wallColor ?? '#ffffff')
  const ceilingColor = useSelector((state: RootState) => state.exhibition.ceilingColor ?? '#ffffff')
  // Bake mode is always the approved look of a baked space (`lookFor`).
  const look = useBakedLook()
  // The ceiling-lamp dimmer, which the corridor's re-rated fixtures keep too (`bakeJob`).
  const recessedDimmer = useBakedDimmer('recessed') ?? 1

  // The latest callbacks and ids, read when they are needed.
  const latest = useRef(props)
  latest.current = props

  const job = useRef({
    phase: 'waiting' as Phase,
    wait: new BakeWait(),
    started: null as StartedBake | null,
    /** Puts the room back (our unwrap, the window daylight). */
    restore: [] as (() => void)[],
    /** Aborted on unmount: every request in flight stops, and nothing more is sent. */
    aborter: new AbortController(),
  })

  const fail = (error: unknown) => {
    const j = job.current
    if (j.phase === 'failed' || j.phase === 'done' || j.aborter.signal.aborted) return
    j.phase = 'failed'
    setBakeAllRooms(false)
    console.error('[AR-161 bake] failed', error)
    latest.current.onError(error instanceof Error ? error : new Error(String(error)))
  }

  useEffect(() => {
    const current = job.current
    current.aborter = new AbortController()
    if (!supportsBaking(gl.getContext())) fail(new Error("This computer can't bake the room."))
    return () => {
      current.aborter.abort()
      current.restore.splice(0).forEach((undo) => undo())
      current.started?.baker.dispose()
      current.started = null
      current.wait = new BakeWait()
      current.phase = 'waiting'
      setBakeAllRooms(false)
    }
    // Once per mount (and the renderer/scene it runs in).
  }, [gl, scene])

  /** Stores the finished bake; tells the page once it is saved (or that nothing was). */
  const save = async (started: StartedBake, artBounce: Map<Mesh, Color>, camera: SpaceCamera) => {
    const { signal } = job.current.aborter
    const { exhibitionId, fingerprint } = latest.current
    const progress = (fraction: number) =>
      latest.current.onProgress({ phase: 'saving', fraction: Math.min(1, fraction) })
    try {
      const { maps, exportMs, encodeMs } = await encodeBakeMaps(
        started.baker,
        (done, total) => progress((ENCODE_SHARE * done) / total),
        signal,
      )
      console.info(
        '[AR-161 bake upload]',
        JSON.stringify({
          maps: maps.map((m) => ({ file: m.file, bytes: m.blob.size, clamped: m.clamped })),
          bytes: maps.reduce((n, m) => n + m.blob.size, 0),
          exportMs,
          encodeMs,
        }),
      )
      const saved = await saveBake({
        exhibitionId,
        files: maps.map((m) => ({ file: m.file, blob: m.blob })),
        record: (bakeId, publicUrls) =>
          buildBakeDraft({
            id: bakeId,
            fingerprint,
            unwrap: started.unwrap,
            maps: maps.map((m) => ({ ...m.map, url: publicUrls[m.file]! })),
            artBounce,
            camera,
            ms: started.baker.stats.ms,
          }),
        origin: window.location.origin,
        signal,
        onProgress: (fraction) => progress(ENCODE_SHARE + (1 - ENCODE_SHARE) * fraction),
      })
      if (signal.aborted) return
      job.current.phase = 'done'
      console.info(
        '[AR-161 bake saved]',
        JSON.stringify({ id: saved.id, maps: saved.maps.length, ms: saved.ms }),
      )
      latest.current.onDone(saved)
    } catch (error) {
      // The page went away: nothing was saved, and no one is left to tell.
      if (signal.aborted) return
      fail(error)
    }
  }

  useFrame((_, delta) => {
    const j = job.current
    if (j.phase !== 'waiting' && j.phase !== 'baking') return
    try {
      if (j.phase === 'waiting') {
        // The room has streamed in, and nothing is still loading: every artwork shown is measured.
        if (!j.wait.ready(delta, useProgress.getState().active)) return
        if (!look.baked) throw new Error("This exhibition's space isn't lit by a bake.")
        j.started = startBake(
          gl,
          scene,
          { wall: wallColor, ceiling: ceilingColor, look: look.space, recessedDimmer },
          j.restore,
        )
        j.phase = 'baking'
        latest.current.onProgress({ phase: 'baking', fraction: 0 })
        return
      }
      const started = j.started!
      if (!bakeSlice(started.run)) {
        latest.current.onProgress({ phase: 'baking', fraction: bakeFraction(started.baker) })
        return
      }
      j.phase = 'saving'
      latest.current.onProgress({ phase: 'baking', fraction: 1 })
      // Artworks: the daylight + bounce measured at each work (mats, frames, text cards).
      const artBounce = measureArtLight(started.baker, started.receivers)
      // The space's fixed camera, recorded with the bake (a later recalibration stales it).
      const camera = bakeCamera(latest.current.spaceId)
      if (BAKE_DEBUG) {
        logBake(started.baker, meterBake(started.baker, scene, artBounce), camera.exposure, 'space')
        // The headless tools wait for these (development only).
        Object.assign(window, {
          __ar161Bake: { baked: true, stats: started.baker.stats },
          __ar161Baker: started.baker,
        })
      }
      void save(started, artBounce, camera)
    } catch (error) {
      fail(error)
    }
  })

  return null
}

export default BakeRunner
