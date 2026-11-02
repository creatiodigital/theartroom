import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { KawaseBlurPass, KernelSize } from 'postprocessing'
import {
  AddEquation,
  Box3,
  CustomBlending,
  Frustum,
  HalfFloatType,
  LinearFilter,
  Matrix4,
  OneFactor,
  OneMinusSrcAlphaFactor,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  ZeroFactor,
  type BufferGeometry,
  type Group,
  type Mesh,
  type Object3D,
} from 'three'

import { BAKE_DEBUG } from '@/components/scene/bake/bakedLook'
import {
  mirrorCamera,
  mirrorScratch,
  type MirrorScratch,
} from '@/components/scene/spaces/objects/planarMirror'

import { nodeBox, roomMiddle, streets } from './ExteriorView'

/**
 * AR-170 — Eduardo 2026-11-02: "our windows glasses could show a little highlights, so we know they
 * are made out of glass, and not just a 'whole', or empty window… in the most subtle way possible".
 * Glass reflects: a pane gives back part of the room — its two faces about 8 % head-on (Fresnel,
 * n = 1.5), more and more at a slant — and lets the rest of the street through. The lamps, the walls
 * and the art behind the visitor show in it as in a real window: faint against the bright street,
 * clearer over its shaded windows.
 *
 * While a window wall is on screen, the room is drawn mirrored in its glass's plane every frame
 * (`planarMirror`) at half the screen's resolution: exact as the visitor walks, where the captured
 * room (`RoomEnvironmentCapture`, one cube from the eye) would slide. The lamps' highlights in it
 * flickered as the visitor moved (Eduardo: "they just flicker a little when I move", "in
 * Florescere, those lights still flicker… some lights flicker, and others do not"), from two causes:
 * - the oblique near plane (three's `Reflector`, the floor's mirror) tilts the far plane and squeezes
 *   the depth range: a lamp, by its distance and angle, blinked in and out of the image. Here a plain
 *   mirrored camera, and what lies beyond the glass (the street, `exteriorStreet`) hidden while it
 *   draws — so nothing outside comes between it and the room;
 * - a lamp's lens is smaller than a pixel of the mirror image: it was in a pixel or not. Drawn with
 *   4× MSAA (its share of each pixel), then softened a touch as a pane's slight waviness does.
 * Measured on Florescere's room-1 window (the mirror alone, the camera 3 mm a step): a highlight's
 * jump between frames 51 % → 8 % (worst 98 % → 22 %).
 *
 * On each pane, the mirror image × the glass's reflectance over the street × what the glass lets
 * through. On screen only, and only while the street shows (frosted glass, acid-etched, gives no
 * image back): the bake never sees it. The alpha underneath (the artwork marker) is kept.
 *
 * In development and staging (`BAKE_DEBUG`), to compare: `?glassreflection=0` none.
 */
export const glassReflectionShown = (): boolean =>
  typeof window !== 'undefined' &&
  !(BAKE_DEBUG && new URLSearchParams(window.location.search).get('glassreflection') === '0')

/** Glass's reflectance head-on, one face: ((n − 1) / (n + 1))², n = 1.5. */
const GLASS_F0 = 0.04
/** The mirror image at this share of the drawing buffer, and its MSAA samples. */
const MIRROR_SCALE = 0.5
const MIRROR_SAMPLES = 4
/** The run order: after the camera moves (priority 0), before the composer draws (1), as `FloorMirror`. */
const MIRROR_PRIORITY = 0.5

const VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4( position, 1.0 );
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

const FRAGMENT = /* glsl */ `
uniform sampler2D mirror;
uniform mat4 mirrorMatrix;
uniform vec3 inward;
varying vec3 vWorld;
void main() {
  vec4 at = mirrorMatrix * vec4( vWorld, 1.0 );
  vec3 room = texture2D( mirror, clamp( at.xy / at.w, 0.001, 0.999 ) ).rgb;
  // One face's reflectance at the angle seen (Schlick); a pane's two faces give back 2R / (1 + R).
  float cosine = clamp( dot( normalize( cameraPosition - vWorld ), inward ), 0.0, 1.0 );
  float face = ${GLASS_F0.toFixed(2)} + ${(1 - GLASS_F0).toFixed(2)} * pow( 1.0 - cosine, 5.0 );
  float pane = 2.0 * face / ( 1.0 + face );
  gl_FragColor = vec4( room * pane, pane );
}
`

interface Mirror {
  panes: number[]
  /** The glass's plane in the model's frame: a point on it, its normal into the room. */
  point: Vector3
  inward: Vector3
  /** The panes' boxes in the model's frame: is the wall on screen. */
  boxes: Box3[]
  target: WebGLRenderTarget
  /** The mirror image softened (`blur`): what the panes show. */
  blurred: WebGLRenderTarget
  blur: KawaseBlurPass
  scratch: MirrorScratch
  material: ShaderMaterial
}

/** The room in the window glass: one mirror per way the panes face (`streets`). */
const GlassReflection = ({
  nodes,
}: {
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
}) => {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const group = useRef<Group>(null)
  const mirrors = useMemo<Mirror[]>(
    () =>
      streets(nodes, roomMiddle(nodes)).map(({ center, outward, panes }) => ({
        panes,
        point: center,
        inward: outward.clone().negate(),
        boxes: panes.map((i) => nodeBox(nodes[`windowGlass${i}`]!)),
        target: new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: MIRROR_SAMPLES }),
        blurred: new WebGLRenderTarget(1, 1, {
          type: HalfFloatType,
          depthBuffer: false,
          minFilter: LinearFilter,
          magFilter: LinearFilter,
        }),
        blur: (() => {
          const pass = new KawaseBlurPass({ kernelSize: KernelSize.VERY_SMALL, resolutionScale: 1 })
          pass.initialize(gl, false, HalfFloatType)
          return pass
        })(),
        scratch: mirrorScratch(),
        material: new ShaderMaterial({
          uniforms: {
            mirror: { value: null },
            mirrorMatrix: { value: new Matrix4() },
            inward: { value: new Vector3() },
          },
          vertexShader: VERTEX,
          fragmentShader: FRAGMENT,
          transparent: true,
          depthWrite: false,
          // The reflection added, the street behind × what the glass lets through; the
          // destination's alpha (the artwork marker) kept.
          blending: CustomBlending,
          blendEquation: AddEquation,
          blendSrc: OneFactor,
          blendDst: OneMinusSrcAlphaFactor,
          blendSrcAlpha: ZeroFactor,
          blendDstAlpha: OneFactor,
        }),
      })),
    [nodes, gl],
  )
  useEffect(() => {
    for (const m of mirrors) m.material.uniforms.mirror!.value = m.blurred.texture
    return () => {
      for (const m of mirrors) {
        m.target.dispose()
        m.blurred.dispose()
        m.blur.dispose()
        m.material.dispose()
      }
    }
  }, [mirrors])
  const work = useMemo(
    () => ({
      buffer: new Vector2(),
      screen: new Matrix4(),
      frustum: new Frustum(),
      box: new Box3(),
      point: new Vector3(),
      normal: new Vector3(),
    }),
    [],
  )

  useFrame(() => {
    const root = group.current
    if (!root) return
    const w = work
    root.updateWorldMatrix(true, false)
    // Where the camera is this frame (its world matrix is otherwise refreshed only when it draws).
    camera.updateMatrixWorld()
    w.frustum.setFromProjectionMatrix(
      w.screen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    )
    gl.getDrawingBufferSize(w.buffer)
    const width = Math.max(1, Math.round(w.buffer.x * MIRROR_SCALE))
    const height = Math.max(1, Math.round(w.buffer.y * MIRROR_SCALE))
    for (const m of mirrors) {
      // Only a window wall on screen.
      const shown = m.boxes.some((b) =>
        w.frustum.intersectsBox(w.box.copy(b).applyMatrix4(root.matrixWorld)),
      )
      if (!shown) continue
      w.point.copy(m.point).applyMatrix4(root.matrixWorld)
      w.normal.copy(m.inward).transformDirection(root.matrixWorld)
      const uniforms = m.material.uniforms
      // A plain mirrored camera (no oblique near plane: see above).
      if (!mirrorCamera(camera, w.point, w.normal, m.scratch, uniforms.mirrorMatrix!.value, false))
        continue
      uniforms.inward!.value.copy(w.normal)
      if (m.target.width !== width || m.target.height !== height) {
        m.target.setSize(width, height)
        m.blurred.setSize(width, height)
        m.blur.setSize(width, height)
      }

      const previous = gl.getRenderTarget()
      const shadows = gl.shadowMap.autoUpdate
      root.visible = false
      // What lies beyond the glass, hidden: nothing outside between the mirrored camera and the room.
      const streets: Object3D[] = []
      scene.traverse((o) => o.name === 'exteriorStreet' && o.visible && streets.push(o))
      for (const s of streets) s.visible = false
      gl.shadowMap.autoUpdate = false
      gl.setRenderTarget(m.target)
      gl.state.buffers.depth.setMask(true)
      gl.clear()
      gl.render(scene, m.scratch.virtual)
      m.blur.render(gl, m.target, m.blurred)
      gl.setRenderTarget(previous)
      gl.shadowMap.autoUpdate = shadows
      for (const s of streets) s.visible = true
      root.visible = true
    }
  }, MIRROR_PRIORITY)

  return (
    <group ref={group}>
      {mirrors.flatMap((m) =>
        m.panes.map((i) => {
          const node = nodes[`windowGlass${i}`]!
          return (
            <mesh
              key={`glass-reflection-${i}`}
              name="glassReflection"
              geometry={node.geometry}
              position={node.position}
              rotation={node.rotation}
              scale={node.scale}
              material={m.material}
              raycast={() => null}
            />
          )
        }),
      )}
    </group>
  )
}

export default GlassReflection
