'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useGLTF } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { Box3, type Mesh, type Object3D, type WebGLRenderer } from 'three'
// drei's GLTFLoader is three-stdlib's: its KTX2 loader must be too.
import { KTX2Loader } from 'three-stdlib'

import { useBenchRooms } from '@/components/scene/spaces/objects/Bench/benchSettings'
import type { FloorArtwork } from '@/lib/floor/floorArtworks'
import type { FloorObject, FloorPedestal } from '@/lib/floor/floorLayout'
import { placeAll, type Placed } from '@/lib/floor/floorPlacement'
import { FINISH_ROUGHNESS, pedestalMaterial } from '@/lib/floor/pedestals'
import { openFloorObject } from '@/redux/slices/floorSlice'
import type { RootState } from '@/redux/store'

import { pedestalGeometry } from './pedestalGeometry'

/**
 * Everything standing on the floor (docs/objects O6): the exhibition's pedestals, built from their
 * parameters, and its Objects, each its own .glb at real size (× its scale) with the bottom centre
 * of its bounding box on its spot. Mounted beside the benches, in the editor and for visitors.
 * Meshes, so the light bake counts them as casters, as it does the benches (an Object whose
 * "Casts a shadow" is off is marked `bakeCaster: false`).
 */
const RAD = Math.PI / 180

// One KTX2 loader per renderer, shared by every model.
const ktx2Loaders = new WeakMap<WebGLRenderer, KTX2Loader>()
const ktx2For = (gl: WebGLRenderer) => {
  let loader = ktx2Loaders.get(gl)
  if (!loader) {
    loader = new KTX2Loader().setTranscoderPath('/basis/').detectSupport(gl)
    ktx2Loaders.set(gl, loader)
  }
  return loader
}
const extendFor = (gl: WebGLRenderer) => (loader: { setKTX2Loader: (l: KTX2Loader) => unknown }) =>
  loader.setKTX2Loader(ktx2For(gl))

/** A pedestal's colour, roughness, metalness and opacity from its material and finish. */
export function pedestalLook(p: FloorPedestal) {
  const material = pedestalMaterial(p.material)
  const colour = p.colour.startsWith('#')
    ? p.colour
    : (material.colours.find((c) => c.id === p.colour)?.hex ?? material.colours[0].hex)
  return {
    color: colour,
    roughness: material.finishes ? FINISH_ROUGHNESS[p.finish] : material.roughness,
    metalness: material.metalness,
    transparent: material.opacity !== undefined,
    opacity: material.opacity ?? 1,
  }
}

function Pedestal({ p, at, floorY }: { p: FloorPedestal; at: Placed; floorY: number }) {
  const geometry = useMemo(
    () => pedestalGeometry(p.shape, p.w, p.d, p.h, p.edges),
    [p.shape, p.w, p.d, p.h, p.edges],
  )
  useEffect(() => () => geometry.dispose(), [geometry])
  const look = pedestalLook(p)
  return (
    <mesh
      name={`pedestal-${p.id}`}
      geometry={geometry}
      position={[at.x, floorY + at.y, at.z]}
      rotation={[0, at.rotY * RAD, 0]}
      userData={{ floorItemId: p.id }}
    >
      <meshStandardMaterial {...look} depthWrite={!look.transparent} />
    </mesh>
  )
}

function FloorModel({
  o,
  at,
  floorY,
  artwork,
}: {
  o: FloorObject
  at: Placed
  floorY: number
  artwork: FloorArtwork
}) {
  const gl = useThree((state) => state.gl)
  const dispatch = useDispatch()
  const isEditMode = useSelector((state: RootState) => state.dashboard.isEditMode)
  const { scene } = useGLTF(artwork.modelUrl, false, true, extendFor(gl))
  // A clone per Object: the cached scene can only sit in one place at a time.
  const model = useMemo(() => scene.clone(true), [scene])
  // The bounding box's bottom centre sits on the spot (owner: never the mesh origin).
  const base = useMemo<[number, number, number]>(() => {
    model.updateMatrixWorld(true)
    const box = new Box3().setFromObject(model)
    return [-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2]
  }, [model])
  useEffect(() => {
    model.traverse((node: Object3D) => {
      if ((node as Mesh).isMesh) node.userData.bakeCaster = o.castShadow
    })
  }, [model, o.castShadow])

  const open = (event: ThreeEvent<MouseEvent>) => {
    if (isEditMode) return
    event.stopPropagation()
    dispatch(openFloorObject(artwork.slug))
  }

  return (
    <group
      name={`floorObject-${o.id}`}
      position={[at.x, floorY + at.y, at.z]}
      rotation={[0, at.rotY * RAD, 0]}
      scale={o.scale}
      userData={{ floorItemId: o.id }}
      onClick={open}
    >
      <primitive object={model} position={base} />
    </group>
  )
}

// Models whose download has started (outside render: see Benches).
const started = new Set<string>()

const FloorItems = () => {
  const layout = useSelector((state: RootState) => state.exhibition.floorLayout)
  const artworks = useSelector((state: RootState) => state.exhibition.floorArtworks)
  const gl = useThree((state) => state.gl)
  const { floorY } = useBenchRooms()
  const placed = useMemo(() => (layout ? placeAll(layout) : []), [layout])

  const urls = useMemo(
    () => [
      ...new Set(
        placed.flatMap(({ item }) =>
          item.kind === 'object' && artworks?.[item.artworkId]
            ? [artworks[item.artworkId].modelUrl]
            : [],
        ),
      ),
    ],
    [placed, artworks],
  )
  const [, setStarted] = useState(0)
  useEffect(() => {
    const fresh = urls.filter((url) => !started.has(url))
    if (!fresh.length) return
    for (const url of fresh) {
      useGLTF.preload(url, false, true, extendFor(gl))
      started.add(url)
    }
    setStarted((n) => n + 1)
  }, [urls, gl])

  return (
    <group name="floorItems">
      {placed.map(({ item, at }) => {
        if (item.kind === 'pedestal') {
          return <Pedestal key={item.id} p={item} at={at} floorY={floorY} />
        }
        const artwork = artworks?.[item.artworkId]
        if (!artwork || !started.has(artwork.modelUrl)) return null
        return (
          // Per Object, so a model still loading never hides the others.
          <Suspense key={item.id} fallback={null}>
            <FloorModel o={item} at={at} floorY={floorY} artwork={artwork} />
          </Suspense>
        )
      })}
    </group>
  )
}

export default FloorItems
