'use client'

import { Component, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useSelector } from 'react-redux'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import { TextureLoader } from 'three'
import type { Object3D } from 'three'

import type { BakeRecord } from '@/lib/bake/bakeRecord'
import { captureError } from '@/lib/observability/captureError'
import type { RootState } from '@/redux/store'
import { artworkIdOf } from '@/components/scene/spaces/objects/Display/artworkId'
import { preloadFloorMaterial } from '@/components/scene/spaces/objects/Floor/ReflectiveFloor'

import { PLASTER, configurePlaster, type BakedMapTexture } from './applyBake'
import { BAKE_DEBUG, markStoredBakeFailed, useBakedLook } from './bakedLook'
import { resetBakeProgress, setBakeProgress } from './bakeProgress'
import { LightmapLoader } from './lightmapLoader'
import { shownArtworkImages } from './receivers'
import { roomSettled, settleStep } from './settle'
import { applyStoredBake } from './storedBake'

/**
 * ⚠️ AR-161 — a stored bake for the admin's review and for visitors: no baking, only its files.
 *
 * The maps (and the plaster) load through r3f's `useLoader`, so this suspends inside the scene's
 * `<Suspense>` with the room's other assets: the monogram loader counts the download, and the
 * room is never shown without its light. Artwork images are not part of that boundary (each
 * loads on its own once its display mounts): the bake goes on once nothing is loading any more
 * and every work it measured shows (`settle.ts`) — a work still missing then failed to load. The
 * loader waits for that (`bakeProgress`). From then on, every frame, an artwork that mounts
 * later (a remount, a rebuilt material) gets the same patches as the rest (`updateArtworks`).
 *
 * The maps fit only the unwrap they were baked into: when this room's unwrap differs (a new
 * model shipped without a rebake), nothing is applied — never a misaligned bake — the mismatch is
 * reported, and the room keeps today's look (`fallBack`). A file that fails to load, or an apply
 * that throws, is reported and falls back the same way.
 */

/** Bakes mounted right now, by id: their cached maps are freed when the last one unmounts. */
const mounted = new Map<string, number>()

const report = (error: unknown, reason: string, extra: Record<string, unknown>) => {
  console.error('[AR-161 stored bake]', reason, extra, error)
  captureError(error, { flow: 'content', stage: `stored-bake-${reason}`, extra })
}

/**
 * The bake can't be shown: the room goes back to today's look, all of it. Today's floor starts
 * loading first (outside render, so its loads never start mid-render); then the bake is marked
 * failed, so `shownStoredBake` no longer holds — `RoomBake` unmounts this, every part of the room
 * renders today's look again, and the loader waits for today's assets, then goes.
 */
const fallBack = (bakeId: string, floorMaterial: string | null | undefined) => {
  preloadFloorMaterial(floorMaterial)
  setBakeProgress('failed', 1)
  markStoredBakeFailed(bakeId)
}

/** Is the room there, and which artworks' images does it show (as the bake measures them)? */
const roomState = (scene: Object3D) => {
  const images = new Set<string>()
  for (const image of shownArtworkImages(scene)) {
    const id = artworkIdOf(image)
    if (id) images.add(id)
  }
  return { room: !!scene.getObjectByName('wall0'), images }
}

const StoredBake = ({ bake }: { bake: BakeRecord }) => {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const wallColor = useSelector((state: RootState) => state.exhibition.wallColor ?? '#ffffff')
  const ceilingColor = useSelector((state: RootState) => state.exhibition.ceilingColor ?? '#ffffff')
  const floorMaterial = useSelector((state: RootState) => state.exhibition.floorMaterial)
  // Only mounted in the approved look (`RoomBake`): the space's look is the one baked.
  const look = useBakedLook()
  const space = look.baked ? look.space : null

  const urls = bake.maps.map((m) => m.url)
  const textures = useLoader(LightmapLoader, urls, (loader) => loader.describe(bake.maps))
  const plasterImages = useLoader(TextureLoader, [PLASTER.normal, PLASTER.roughness])
  const plaster = useMemo(
    () =>
      plasterImages.length === 2
        ? configurePlaster({ normal: plasterImages[0]!, roughness: plasterImages[1]! }, gl)
        : null,
    [plasterImages, gl],
  )
  const maps: BakedMapTexture[] = bake.maps.map((m, i) => ({
    receiver: m.receiver,
    kind: m.kind,
    texture: textures[i]!,
  }))

  // Everything the apply needs, read when it happens (it happens once per mount).
  const latest = useRef({ bake, maps, plaster, wallColor, ceilingColor, space, floorMaterial })
  latest.current = { bake, maps, plaster, wallColor, ceilingColor, space, floorMaterial }
  const job = useRef({
    applied: false,
    undo: null as (() => void) | null,
    updateArtworks: null as (() => void) | null,
    idle: 0,
  })

  useEffect(() => {
    const current = job.current
    const { id } = latest.current.bake
    const loaded = { urls, textures, plaster: plasterImages }
    mounted.set(id, (mounted.get(id) ?? 0) + 1)
    // Until the bake is on, the loader keeps the room covered.
    setBakeProgress('running', 0)
    return () => {
      current.undo?.()
      current.undo = null
      current.updateArtworks = null
      current.applied = false
      current.idle = 0
      resetBakeProgress()
      mounted.set(id, (mounted.get(id) ?? 1) - 1)
      // After this commit: a remount of the same bake (React's development double mount)
      // keeps its maps; otherwise free them (GPU now, memory with the loader's cache).
      setTimeout(() => {
        if (mounted.get(id)) return
        mounted.delete(id)
        loaded.textures.forEach((t) => t.dispose())
        loaded.plaster.forEach((t) => t.dispose())
        useLoader.clear(LightmapLoader, loaded.urls)
      })
    }
    // Once per mount: `BakedLighting` is keyed by the bake's id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame((_, delta) => {
    const j = job.current
    const now = latest.current
    if (j.applied) {
      if (!j.updateArtworks) return
      try {
        // An artwork that mounted since the last frame gets its patches before it is drawn.
        j.updateArtworks()
      } catch (error) {
        // Never half lit: the whole bake comes off, and today's look comes back.
        j.undo?.()
        j.undo = null
        j.updateArtworks = null
        report(error, 'apply-failed', { bakeId: now.bake.id })
        fallBack(now.bake.id, now.floorMaterial)
      }
      return
    }
    try {
      j.idle = settleStep(j.idle, delta, useProgress.getState().active)
      const { room, images } = roomState(scene)
      const missing = Object.keys(now.bake.artLight).filter((id) => !images.has(id))
      if (!roomSettled({ room, idle: j.idle, missing: missing.length })) return
      j.applied = true
      if (!now.space) throw new Error('A stored bake outside a baked space')
      const result = applyStoredBake(scene, now.bake, now.maps, now.plaster, {
        wall: now.wallColor,
        ceiling: now.ceilingColor,
        look: now.space,
      })
      if (result.ok) {
        j.undo = result.undo
        j.updateArtworks = result.updateArtworks
        // Nothing has loaded for a while and these never showed: their images failed.
        if (missing.length)
          console.warn('[AR-161 stored bake] applied without the failed artwork(s)', missing)
        // Diagnostics: the headless tools wait for this before measuring the room.
        if (BAKE_DEBUG)
          Object.assign(window, { __ar161Bake: { stored: now.bake.id, camera: now.bake.camera } })
        setBakeProgress('finished', 1)
        return
      }
      report(
        result.error ?? new Error(`Stored bake not applied: ${result.reason}`),
        result.reason,
        { bakeId: now.bake.id, ...result.detail },
      )
    } catch (error) {
      j.applied = true
      report(error, 'apply-failed', { bakeId: now.bake.id })
    }
    // Nothing was applied (or it was all undone): today's look, and the room can be shown.
    fallBack(now.bake.id, now.floorMaterial)
  })

  return null
}

/** A map that fails to load (or decode) leaves today's look, reported — never a broken room. */
class StoredBakeBoundary extends Component<
  { bakeId: string; floorMaterial: string | null | undefined; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    report(error, 'load-failed', { bakeId: this.props.bakeId })
    fallBack(this.props.bakeId, this.props.floorMaterial)
  }

  // React's development double mount unmounts and remounts after `componentDidCatch`: the
  // remount says it again (a no-op once the bake is marked failed).
  componentDidMount() {
    if (this.state.failed) fallBack(this.props.bakeId, this.props.floorMaterial)
  }

  componentWillUnmount() {
    resetBakeProgress()
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

/** Key it by `bake.id`: a different bake is a new mount (its own files, its own apply). */
export const BakedLighting = ({ bake }: { bake: BakeRecord }) => {
  const floorMaterial = useSelector((state: RootState) => state.exhibition.floorMaterial)
  return (
    <StoredBakeBoundary bakeId={bake.id} floorMaterial={floorMaterial}>
      <StoredBake bake={bake} />
    </StoredBakeBoundary>
  )
}

export default BakedLighting
