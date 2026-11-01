import { useEffect, useMemo, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { KawaseBlurPass, KernelSize } from 'postprocessing'
import {
  HalfFloatType,
  LinearFilter,
  Matrix4,
  PerspectiveCamera,
  Plane,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type Mesh,
} from 'three'

import {
  FLOOR_MIRROR,
  mirrorReliefFlag,
  mirrorStrengthFlag,
} from '@/components/scene/bake/floorMirror'
import { GLASS_GAIN } from '@/components/scene/spaces/objects/Windows/frostedGlass'

/**
 * The frosted glass in the mirror at the sky's brightness: the bake's daylight (6× what the glass
 * shows) over what the frosted glass shows (2×) — on screen it stays below white; in a reflection,
 * which takes a few percent of it, its real brightness is what makes the streak of light on the
 * floor.
 */
const MIRROR_GLASS_GAIN = 3

/** The mirror image at this share of the drawing buffer (half: it is blurred anyway). */
const MIRROR_SCALE = 0.5

/**
 * The run order: after the camera moves (`MainCamera`, priority 0), before the composer draws
 * (priority 1) — a mirror drawn from the camera's previous place slid across the floor as the
 * visitor walked (Eduardo 2026-10-31: "when I move the camera the soft coat moves").
 */
const MIRROR_PRIORITY = 0.5

/**
 * ⚠️ AR-169 TRIAL (`floorMirror.ts`): every frame, after the camera moves and before the
 * composer, the room drawn mirrored under the floor into a half-resolution HDR image, then
 * blurred (Kawase) into the image the floor's shader samples — three's `Reflector`, in world
 * space, with its oblique near plane at the floor (nothing under the floor draws).
 */
export const FloorMirror = ({ floor, blur }: { floor: RefObject<Mesh | null>; blur: number }) => {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const target = useMemo(() => new WebGLRenderTarget(1, 1, { type: HalfFloatType }), [])
  const blurred = useMemo(
    () =>
      new WebGLRenderTarget(1, 1, {
        type: HalfFloatType,
        depthBuffer: false,
        minFilter: LinearFilter,
        magFilter: LinearFilter,
      }),
    [],
  )
  const blurPass = useMemo(() => {
    const pass = new KawaseBlurPass({ kernelSize: KernelSize.LARGE, resolutionScale: 0.5 })
    pass.initialize(gl, false, HalfFloatType)
    pass.scale = blur
    return pass
  }, [gl, blur])
  const work = useMemo(
    () => ({
      virtual: new PerspectiveCamera(),
      buffer: new Vector2(),
      planePoint: new Vector3(),
      normal: new Vector3(),
      cameraPosition: new Vector3(),
      view: new Vector3(),
      lookAt: new Vector3(),
      aim: new Vector3(),
      rotation: new Matrix4(),
      plane: new Plane(),
      clip: new Vector4(),
      q: new Vector4(),
      glassGain: MIRROR_GLASS_GAIN,
    }),
    [],
  )
  useEffect(() => {
    FLOOR_MIRROR.floorMirror.value = blurred.texture
    FLOOR_MIRROR.floorMirrorStrength.value = mirrorStrengthFlag()
    FLOOR_MIRROR.floorMirrorRelief.value = mirrorReliefFlag()
    return () => {
      FLOOR_MIRROR.floorMirror.value = null
      target.dispose()
      blurred.dispose()
      blurPass.dispose()
    }
  }, [target, blurred, blurPass])

  useFrame(() => {
    const mesh = floor.current
    if (!mesh) return
    const w = work
    gl.getDrawingBufferSize(w.buffer)
    const width = Math.max(1, Math.round(w.buffer.x * MIRROR_SCALE))
    const height = Math.max(1, Math.round(w.buffer.y * MIRROR_SCALE))
    if (target.width !== width || target.height !== height) {
      target.setSize(width, height)
      blurred.setSize(width, height)
      blurPass.setSize(width, height)
    }

    // The floor plane: its centre and normal (a plane geometry faces +z; the floor turns it up).
    mesh.updateMatrixWorld()
    // Where the camera is this frame (its world matrix is otherwise refreshed only when it draws).
    camera.updateMatrixWorld()
    w.planePoint.setFromMatrixPosition(mesh.matrixWorld)
    w.rotation.extractRotation(mesh.matrixWorld)
    w.normal.set(0, 0, 1).applyMatrix4(w.rotation)
    w.cameraPosition.setFromMatrixPosition(camera.matrixWorld)
    w.view.subVectors(w.planePoint, w.cameraPosition)
    if (w.view.dot(w.normal) > 0) return // under the floor: nothing to reflect
    w.view.reflect(w.normal).negate().add(w.planePoint)
    w.rotation.extractRotation(camera.matrixWorld)
    w.lookAt.set(0, 0, -1).applyMatrix4(w.rotation).add(w.cameraPosition)
    w.aim.subVectors(w.planePoint, w.lookAt).reflect(w.normal).negate().add(w.planePoint)

    const virtual = w.virtual
    virtual.position.copy(w.view)
    virtual.up.set(0, 1, 0).applyMatrix4(w.rotation).reflect(w.normal)
    virtual.lookAt(w.aim)
    virtual.far = (camera as PerspectiveCamera).far
    virtual.layers.mask = camera.layers.mask
    virtual.updateMatrixWorld()
    virtual.projectionMatrix.copy(camera.projectionMatrix)

    // World → the mirror image's UV.
    FLOOR_MIRROR.floorMirrorMatrix.value
      .set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
      .multiply(virtual.projectionMatrix)
      .multiply(virtual.matrixWorldInverse)

    // The near plane on the floor (Lengyel's oblique projection), as three's Reflector.
    w.plane.setFromNormalAndCoplanarPoint(w.normal, w.planePoint)
    w.plane.applyMatrix4(virtual.matrixWorldInverse)
    w.clip.set(w.plane.normal.x, w.plane.normal.y, w.plane.normal.z, w.plane.constant)
    const p = virtual.projectionMatrix.elements
    w.q.set(
      (Math.sign(w.clip.x) + p[8]!) / p[0]!,
      (Math.sign(w.clip.y) + p[9]!) / p[5]!,
      -1,
      (1 + p[10]!) / p[14]!,
    )
    w.clip.multiplyScalar(2 / w.clip.dot(w.q))
    p[2] = w.clip.x
    p[6] = w.clip.y
    p[10] = w.clip.z + 1
    p[14] = w.clip.w

    const previous = gl.getRenderTarget()
    const shadows = gl.shadowMap.autoUpdate
    mesh.visible = false
    GLASS_GAIN.value = w.glassGain
    gl.shadowMap.autoUpdate = false
    gl.setRenderTarget(target)
    gl.state.buffers.depth.setMask(true)
    gl.clear()
    gl.render(scene, virtual)
    blurPass.render(gl, target, blurred)
    gl.setRenderTarget(previous)
    gl.shadowMap.autoUpdate = shadows
    GLASS_GAIN.value = 1
    mesh.visible = true
  }, MIRROR_PRIORITY)

  return null
}
