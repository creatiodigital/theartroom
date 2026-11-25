'use client'

import { Component, Suspense, useEffect, useRef, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bounds, OrbitControls, useBounds, useGLTF } from '@react-three/drei'
import {
  Box3,
  PMREMGenerator,
  Spherical,
  Vector3,
  type PerspectiveCamera,
  type Texture,
  type WebGLRenderer,
} from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
// drei's GLTFLoader is three-stdlib's: its KTX2 loader must be too (as drei's useKTX2).
import { KTX2Loader } from 'three-stdlib'

import styles from './ModelViewer.module.scss'

/**
 * An Object's 3D model, to turn and zoom (docs/objects O4, the editor's preview; O5 reuses it on
 * the artwork page): a small R3F canvas, the 3D room's loaders (meshopt, KTX2 with the room's
 * basis transcoder; no Draco), neutral studio light. The model is shown as it was exported, never
 * re-centred, so a base off y = 0 is visible. Import it with next/dynamic: three.js is loaded
 * only where a model is shown.
 *
 * `onResult` reports what the GLB checker needs: it loaded, compiled and drew (or why not), its
 * world bounds in metres, and its textures' sizes.
 */
export type ModelViewerResult =
  | {
      ok: true
      bounds: { min: [number, number, number]; max: [number, number, number] }
      textureSizes: { width: number; height: number }[]
    }
  | { ok: false; error: string }

type ModelViewerProps = {
  url: string
  onResult?: (result: ModelViewerResult) => void
  /** Bump to frame the model again ("Reset view"). */
  resetKey?: number
  /** One line over the bottom left, e.g. "Drag to turn · scroll to zoom". */
  hint?: string
  /** dark (default): the editor's preview; light: transparent, on the artwork page's grey stage. */
  tone?: 'dark' | 'light'
  className?: string
}

const SHADER_ERROR = 'A material could not be compiled for WebGL'

class LoadBoundary extends Component<
  { onError: (message: string) => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    this.props.onError(error instanceof Error ? error.message : 'It could not be loaded')
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

function textureSizesOf(root: Box3Source): { width: number; height: number }[] {
  const seen = new Set<Texture>()
  root.traverse((node) => {
    const material = (node as { material?: unknown }).material
    for (const m of Array.isArray(material) ? material : material ? [material] : []) {
      for (const value of Object.values(m as Record<string, unknown>)) {
        if (value && (value as Texture).isTexture) seen.add(value as Texture)
      }
    }
  })
  return [...seen].map((t) => {
    const image = t.image as { width?: number; height?: number } | undefined
    return { width: image?.width ?? 0, height: image?.height ?? 0 }
  })
}

type Box3Source = Parameters<Box3['setFromObject']>[0]

/** The framing's margin (Bounds) and how far the wheel may go from it (owner, 2026-11-25: "Don't
 * let this zoom in or out that much"): in to 75 % of the framed distance, out to 150 %. */
const FRAME_MARGIN = 1.25
const ZOOM_IN = 0.75
const ZOOM_OUT = 1.5
/** Where the view starts (and Reset view goes back to): front, a little right and above. */
const START: [number, number, number] = [2, 1.5, 3]
/** Stable, so a re-render never re-applies it to the camera. */
const CAMERA = { fov: 35, position: START }
/** Stable, like CAMERA: nothing for R3F to re-apply when the page re-renders. */
const DPR: [number, number] = [1, 2]
/** The viewer's own size only: scrolling the page never re-measures the canvas. */
const RESIZE = { scroll: false }

type DistanceControls = { minDistance: number; maxDistance: number }

/** Models to free once their viewer is really gone (see Model's cleanup). */
const pendingRelease = new Map<string, ReturnType<typeof setTimeout>>()
const RELEASE_DELAY_MS = 1000

function Model({
  url,
  shaderError,
  framedRef,
  onResult,
}: {
  url: string
  shaderError: { current: boolean }
  framedRef: { current: number | null }
  onResult?: (result: ModelViewerResult) => void
}) {
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const ktx2Ref = useRef<KTX2Loader | null>(null)
  const gltf = useGLTF(url, false, true, (loader) => {
    const ktx2 = new KTX2Loader().setTranscoderPath('/basis/').detectSupport(gl)
    ktx2Ref.current = ktx2
    loader.setKTX2Loader(ktx2)
  })

  useEffect(() => {
    // Compile every material now, so a shader that fails is known before "ok" is said.
    gl.compile(gltf.scene, camera)
    const box = new Box3().setFromObject(gltf.scene)
    if (shaderError.current) onResult?.({ ok: false, error: SHADER_ERROR })
    else if (box.isEmpty()) onResult?.({ ok: false, error: 'Nothing to draw: no geometry found' })
    else
      onResult?.({
        ok: true,
        bounds: { min: box.min.toArray(), max: box.max.toArray() },
        textureSizes: textureSizesOf(gltf.scene),
      })
  }, [gltf, gl, camera, shaderError, onResult])

  // The distance drei's Bounds frames the model at (its largest side, the lens, the viewer's
  // shape, the margin): the wheel stays near it (ZoomLimits).
  useEffect(() => {
    const box = new Box3().setFromObject(gltf.scene)
    if (box.isEmpty()) return
    const size = box.getSize(new Vector3())
    const lens = camera as PerspectiveCamera
    const fitHeight = Math.max(size.x, size.y, size.z) / (2 * Math.atan((Math.PI * lens.fov) / 360))
    framedRef.current = FRAME_MARGIN * Math.max(fitHeight, fitHeight / (lens.aspect || 1))
  }, [gltf, camera, framedRef])

  // Free the model when the viewer goes, a moment later: React (Strict Mode, in development) runs
  // this cleanup once right after mounting, and clearing the cache then made the next re-render
  // load the model again, hidden meanwhile: the "blink" (owner, 2026-11-25).
  useEffect(() => {
    const ktx2 = ktx2Ref.current
    clearTimeout(pendingRelease.get(url))
    pendingRelease.delete(url)
    return () => {
      pendingRelease.set(
        url,
        setTimeout(() => {
          pendingRelease.delete(url)
          ktx2?.dispose()
          // Only a file being checked (a blob: of the upload window) is freed: a stored model's
          // cache is shared with the 3D room, which would load it again (and blink) after the
          // artwork window closed.
          if (url.startsWith('blob:')) useGLTF.clear(url)
        }, RELEASE_DELAY_MS),
      )
    }
  }, [url])

  return <primitive object={gltf.scene} />
}

/**
 * A neutral studio around the model (owner, 2026-11-25: "add more light"): three's RoomEnvironment
 * as the scene's environment, so metal and gloss have something to reflect (without it they read
 * black). Built in the browser, nothing downloaded.
 */
function StudioEnvironment() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const texture = pmrem.fromScene(room, 0.04).texture
    scene.environment = texture
    return () => {
      scene.environment = null
      texture.dispose()
      room.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])
  return null
}

/** How long Reset view's glide takes. */
const RESET_S = 0.7

type OrbitTarget = { target: Vector3; update: () => void }

/**
 * Reset view (owner, 2026-11-25: "make it smooth, no blinking"): the camera glides around the
 * model back to the starting angle and the framed distance, always aimed at it (the angles and the
 * distance are eased together; turning and moving separately made it look away for a moment).
 */
function Reframe({ resetKey }: { resetKey: number }) {
  const bounds = useBounds()
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as unknown as OrbitTarget | null
  const glide = useRef<{
    from: Spherical
    to: Spherical
    fromTarget: Vector3
    toTarget: Vector3
    t: number
  } | null>(null)

  useEffect(() => {
    if (resetKey === 0 || !controls) return
    const { center, distance } = bounds.refresh().getSize()
    const from = new Spherical().setFromVector3(camera.position.clone().sub(controls.target))
    const to = new Spherical().setFromVector3(new Vector3(...START).sub(center).setLength(distance))
    // The short way round.
    let turn = to.theta - from.theta
    if (turn > Math.PI) turn -= 2 * Math.PI
    if (turn < -Math.PI) turn += 2 * Math.PI
    to.theta = from.theta + turn
    glide.current = { from, to, fromTarget: controls.target.clone(), toTarget: center, t: 0 }
  }, [resetKey, bounds, camera, controls])

  useFrame((_, delta) => {
    const g = glide.current
    if (!g || !controls) return
    g.t = Math.min(1, g.t + delta / RESET_S)
    const k = g.t * g.t * (3 - 2 * g.t)
    const at = new Spherical(
      g.from.radius + (g.to.radius - g.from.radius) * k,
      g.from.phi + (g.to.phi - g.from.phi) * k,
      g.from.theta + (g.to.theta - g.from.theta) * k,
    )
    controls.target.lerpVectors(g.fromTarget, g.toTarget, k)
    camera.position.copy(controls.target).add(new Vector3().setFromSpherical(at))
    camera.lookAt(controls.target)
    controls.update()
    if (g.t >= 1) glide.current = null
  })
  return null
}

/** Keeps the wheel near the framed view, every frame: Bounds widens the limit when it refits. */
function ZoomLimits({ framedRef }: { framedRef: { current: number | null } }) {
  useFrame((state) => {
    const controls = state.controls as unknown as DistanceControls | null
    const framed = framedRef.current
    if (!controls || !framed) return
    controls.minDistance = framed * ZOOM_IN
    controls.maxDistance = framed * ZOOM_OUT
  })
  return null
}

export default function ModelViewer({
  url,
  onResult,
  resetKey = 0,
  hint,
  tone = 'dark',
  className,
}: ModelViewerProps) {
  const shaderError = useRef(false)
  const framedRef = useRef<number | null>(null)
  const onCreated = ({ gl }: { gl: WebGLRenderer }) => {
    // Three only logs a shader that fails to compile; the checker must know.
    gl.debug.onShaderError = () => {
      shaderError.current = true
      onResult?.({ ok: false, error: SHADER_ERROR })
    }
  }

  return (
    <div className={`${styles.viewer} ${tone === 'light' ? styles.light : ''} ${className ?? ''}`}>
      <Canvas dpr={DPR} camera={CAMERA} resize={RESIZE} onCreated={onCreated}>
        <StudioEnvironment />
        <hemisphereLight args={['#ffffff', '#666666', 1.5]} />
        <directionalLight position={[3, 5, 4]} intensity={2.5} />
        <directionalLight position={[-4, 3, -3]} intensity={1} />
        <ambientLight intensity={0.4} />
        <LoadBoundary onError={(error) => onResult?.({ ok: false, error })}>
          <Suspense fallback={null}>
            {/* No `observe`: the view is framed once (a refit on resize turns the camera); Reset
                view glides back to it. */}
            <Bounds fit clip margin={FRAME_MARGIN}>
              <Model
                url={url}
                shaderError={shaderError}
                framedRef={framedRef}
                onResult={onResult}
              />
              <Reframe resetKey={resetKey} />
            </Bounds>
          </Suspense>
        </LoadBoundary>
        <OrbitControls makeDefault />
        <ZoomLimits framedRef={framedRef} />
      </Canvas>
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  )
}
