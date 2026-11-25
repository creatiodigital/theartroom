'use client'

import { Component, Suspense, useEffect, useRef, type ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Bounds, OrbitControls, useBounds, useGLTF } from '@react-three/drei'
import { Box3, PMREMGenerator, type Texture, type WebGLRenderer } from 'three'
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

function Model({
  url,
  shaderError,
  onResult,
}: {
  url: string
  shaderError: { current: boolean }
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

  useEffect(
    () => () => {
      ktx2Ref.current?.dispose()
      useGLTF.clear(url)
    },
    [url],
  )

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

function Reframe({ resetKey }: { resetKey: number }) {
  const bounds = useBounds()
  useEffect(() => {
    if (resetKey > 0) bounds.refresh().clip().fit()
  }, [resetKey, bounds])
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
  const onCreated = ({ gl }: { gl: WebGLRenderer }) => {
    // Three only logs a shader that fails to compile; the checker must know.
    gl.debug.onShaderError = () => {
      shaderError.current = true
      onResult?.({ ok: false, error: SHADER_ERROR })
    }
  }

  return (
    <div className={`${styles.viewer} ${tone === 'light' ? styles.light : ''} ${className ?? ''}`}>
      <Canvas dpr={[1, 2]} camera={{ fov: 35, position: [2, 1.5, 3] }} onCreated={onCreated}>
        <StudioEnvironment />
        <hemisphereLight args={['#ffffff', '#666666', 1.5]} />
        <directionalLight position={[3, 5, 4]} intensity={2.5} />
        <directionalLight position={[-4, 3, -3]} intensity={1} />
        <ambientLight intensity={0.4} />
        <LoadBoundary onError={(error) => onResult?.({ ok: false, error })}>
          <Suspense fallback={null}>
            <Bounds fit clip observe margin={1.25}>
              <Model url={url} shaderError={shaderError} onResult={onResult} />
              <Reframe resetKey={resetKey} />
            </Bounds>
          </Suspense>
        </LoadBoundary>
        <OrbitControls makeDefault />
      </Canvas>
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  )
}
