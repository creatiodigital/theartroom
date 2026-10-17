'use client'

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  CubeCamera,
  HalfFloatType,
  PMREMGenerator,
  Vector3,
  WebGLCubeRenderTarget,
  type WebGLRenderTarget,
} from 'three'

/**
 * ⚠️ AR-161 REALISM PROBE — DEV-ONLY, THROWAWAY. DO NOT SHIP AS-IS.
 *
 * Physically based bounce light for everything that is not baked (artworks, frames, panels,
 * floor, lamp bodies): render the ACTUAL room into a cube map from where the visitor stands,
 * prefilter it (PMREM), and make it `scene.environment`. Every MeshStandardMaterial then gets
 * its diffuse bounce and its Fresnel-correct reflection from the real walls, lamps and art —
 * the same light the room is actually emitting — instead of a flat ambient term or a
 * synthetic Lightformer room.
 *
 * Lambert walls/ceiling are untouched by `scene.environment` (three only applies it to
 * Standard materials), which is what we want: their bounce comes from the Blender bake, so
 * they are not lit twice.
 *
 * Captured twice per pass so the second capture already includes the first's bounce, and
 * recaptured when the visitor has walked far enough that the room around them changed.
 * Linear HDR throughout: the composer sets NoToneMapping and this renders to a target.
 */

const CAPTURE_SIZE = 256
const BOUNCES = 2
/** Seconds after mount: once the room has rendered, and again once artworks have streamed in. */
const CAPTURE_TIMES = [1.5, 6]
/** Metres walked before the room around the visitor is considered different. */
const RECAPTURE_DISTANCE = 4

// Set by the load-time bake when it swaps baked light onto the room: the room the environment
// captured a moment ago no longer exists, so take a fresh look.
let recaptureRequested = false
export const requestRoomRecapture = () => {
  recaptureRequested = true
}

interface CaptureState {
  cubeRT: WebGLCubeRenderTarget
  cubeCamera: CubeCamera
  pmrem: PMREMGenerator
  envRT: WebGLRenderTarget | null
  lastPosition: Vector3 | null
  elapsed: number
  nextScheduled: number
}

export const RoomEnvironmentCapture = ({ intensity = 1 }: { intensity?: number }) => {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const capture = useRef<CaptureState | null>(null)

  useEffect(() => {
    const cubeRT = new WebGLCubeRenderTarget(CAPTURE_SIZE, { type: HalfFloatType })
    const cubeCamera = new CubeCamera(0.05, 200, cubeRT)
    const pmrem = new PMREMGenerator(gl)
    const previousEnvironment = scene.environment
    capture.current = {
      cubeRT,
      cubeCamera,
      pmrem,
      envRT: null,
      lastPosition: null,
      elapsed: 0,
      nextScheduled: 0,
    }
    return () => {
      scene.environment = previousEnvironment
      capture.current?.envRT?.dispose()
      cubeRT.dispose()
      pmrem.dispose()
      capture.current = null
    }
  }, [gl, scene])

  useEffect(() => {
    scene.environmentIntensity = intensity
    return () => {
      scene.environmentIntensity = 1
    }
  }, [scene, intensity])

  useFrame((_, delta) => {
    const c = capture.current
    if (!c) return
    c.elapsed += delta

    const scheduled =
      c.nextScheduled < CAPTURE_TIMES.length && c.elapsed >= CAPTURE_TIMES[c.nextScheduled]!
    const walked =
      c.lastPosition !== null && c.lastPosition.distanceTo(camera.position) >= RECAPTURE_DISTANCE
    const requested = recaptureRequested
    if (!scheduled && !walked && !requested) return
    if (scheduled) c.nextScheduled += 1
    recaptureRequested = false

    c.cubeCamera.position.copy(camera.position)
    for (let i = 0; i < BOUNCES; i++) {
      c.cubeCamera.update(gl, scene)
      const next = c.pmrem.fromCubemap(c.cubeRT.texture)
      const previous = c.envRT
      c.envRT = next
      scene.environment = next.texture
      previous?.dispose()
    }
    c.lastPosition = camera.position.clone()
  })

  return null
}

export default RoomEnvironmentCapture
