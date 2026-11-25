'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Line, useGLTF } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { Box3, type Mesh, type Object3D, type WebGLRenderer } from 'three'
// drei's GLTFLoader is three-stdlib's: its KTX2 loader must be too.
import { KTX2Loader } from 'three-stdlib'

import { useBenchRooms } from '@/components/scene/spaces/objects/Bench/benchSettings'
import { floorSizes, type FloorArtwork, type FloorSizes } from '@/lib/floor/floorArtworks'
import type { FloorLayout, FloorObject, FloorPedestal } from '@/lib/floor/floorLayout'
import {
  belowFloor,
  modelOffset,
  overhangs,
  placeAll,
  type Placed,
} from '@/lib/floor/floorPlacement'
import { clickedSide, sideFace, toObject, toWorld } from '@/lib/floor/objectSide'
import { FINISH_ROUGHNESS, pedestalMaterial } from '@/lib/floor/pedestals'
import { woodMapSet } from '@/components/scene/spaces/objects/Frame/woodTextures'
import { useFloorRooms } from '@/components/floorview/useFloorRooms'
import { DOUBLE_TAP_MS, useTapTracker } from '@/components/scene/spaces/objects/tapTracker'
import { openFloorObject } from '@/redux/slices/floorSlice'
import { setFocusTarget } from '@/redux/slices/sceneSlice'
import type { RootState } from '@/redux/store'

import { pedestalGeometry } from './pedestalGeometry'
import { useFloorDrag } from './useFloorDrag'

/** The Floor view's press on an item (picking, dragging); absent for visitors. */
type FloorDown = (event: ThreeEvent<PointerEvent>, id: string) => void

/** A click, not a drag: as the works on the walls (Display). */
const CLICK_MAX_MOVE_PX = 5
const CLICK_MAX_MS = 300

/**
 * Everything standing on the floor (docs/objects O6): the exhibition's pedestals, built from their
 * parameters, and its Objects, each its own .glb at real size (× its scale), each one's bounding
 * box centered where `placeAll` puts it, turned as it says (floor composing: attached to each other's
 * faces, tilted). Mounted beside the benches, in the editor and for visitors.
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

/** A pedestal's color, roughness, metalness and opacity from its material and finish. */
export function pedestalLook(p: FloorPedestal) {
  const material = pedestalMaterial(p.material)
  const color = material.colors.find((c) => c.id === p.color)
  return {
    // Wood: the texture is the color.
    color: color?.texture
      ? '#ffffff'
      : p.color.startsWith('#')
        ? p.color
        : (color?.hex ?? material.colors[0].hex),
    roughness: material.finishes ? FINISH_ROUGHNESS[p.finish] : material.roughness,
    metalness: material.metalness,
    transparent: material.opacity !== undefined,
    opacity: material.opacity ?? 1,
  }
}

/** Where an item is drawn: its box's center, turned (`placeAll`). */
const transformOf = (at: Placed, floorY: number) => ({
  position: [at.x, floorY + at.cy, at.z] as [number, number, number],
  quaternion: at.quaternion,
})

/** Wood (the frames' PBR maps, owner 2026-11-25): its own clones of the shared maps, grain seeded by id. */
function useWood(p: FloorPedestal) {
  const texture = pedestalMaterial(p.material).colors.find((c) => c.id === p.color)?.texture
  const maps = useMemo(() => (texture ? woodMapSet(texture, p.id) : null), [texture, p.id])
  useEffect(
    () => () => {
      maps?.map.dispose()
      maps?.normalMap.dispose()
      maps?.roughnessMap.dispose()
    },
    [maps],
  )
  return maps
}

const WOOD_NORMAL_SCALE: [number, number] = [0.5, 0.5]

function Pedestal({
  p,
  at,
  floorY,
  onFloorDown,
}: {
  p: FloorPedestal
  at: Placed
  floorY: number
  onFloorDown?: FloorDown
}) {
  const geometry = useMemo(
    () => pedestalGeometry(p.shape, p.w, p.d, p.h, p.edges),
    [p.shape, p.w, p.d, p.h, p.edges],
  )
  useEffect(() => () => geometry.dispose(), [geometry])
  const look = pedestalLook(p)
  const wood = useWood(p)
  return (
    <group
      name={`pedestal-${p.id}`}
      {...transformOf(at, floorY)}
      userData={{ floorItemId: p.id }}
      onPointerDown={onFloorDown && ((event) => onFloorDown(event, p.id))}
    >
      {/* The geometry stands on y = 0: its center to the group's. */}
      <mesh geometry={geometry} position={[0, -p.h / 200, 0]} userData={{ floorItemId: p.id }}>
        {wood ? (
          <meshStandardMaterial key="wood" {...look} {...wood} normalScale={WOOD_NORMAL_SCALE} />
        ) : (
          <meshStandardMaterial key="flat" {...look} depthWrite={!look.transparent} />
        )}
      </mesh>
    </group>
  )
}

function FloorModel({
  o,
  at,
  floorY,
  artwork,
  onFloorDown,
}: {
  o: FloorObject
  at: Placed
  floorY: number
  artwork: FloorArtwork
  onFloorDown?: FloorDown
}) {
  const gl = useThree((state) => state.gl)
  const dispatch = useDispatch()
  const isEditMode = useSelector((state: RootState) => state.dashboard.isEditMode)
  const { scene } = useGLTF(artwork.modelUrl, false, true, extendFor(gl))
  // A clone per Object: the cached scene can only sit in one place at a time.
  const model = useMemo(() => scene.clone(true), [scene])
  // The model's box on the placed box (owner: never the mesh origin): centered, or, with no measured
  // size, standing on its bottom.
  const box = useMemo(() => {
    model.updateMatrixWorld(true)
    return new Box3().setFromObject(model)
  }, [model])
  const centered = modelOffset(box, at, o.scale, !!artwork.boundsCm)
  useEffect(() => {
    model.traverse((node: Object3D) => {
      if ((node as Mesh).isMesh) node.userData.bakeCaster = o.castShadow
    })
  }, [model, o.castShadow])

  // As a photo on a wall (Display): a click (or tap) comes nearer, a double click (or double tap)
  // opens the Object's page. Nearer along the camera's own line of sight, at its eye height: never
  // stepping round to stand in front (owner, 2026-11-25).
  const camera = useThree((state) => state.camera)
  const taps = useTapTracker()
  const pressed = useRef<{
    x: number
    y: number
    at: number
    hit: { x: number; y: number; z: number }
  } | null>(null)
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => clearTimeout(pending.current ?? undefined), [])

  const openPage = () => dispatch(openFloorObject(artwork.slug))
  // The side of its box that was clicked (the top or bottom: the nearest side facing the camera):
  // the camera comes to stand in front of it (owner, 2026-11-25).
  // A tilted Object: its box as the room's axes see it.
  const comeNearer = (hit: { x: number; y: number; z: number }) => {
    const [w, d, h] = at.upright
      ? [at.size.w / 100, at.size.d / 100, at.size.h / 100]
      : [at.max.x - at.min.x, at.max.z - at.min.z, at.max.y - at.min.y]
    const origin = { x: at.x, y: floorY + at.y, z: at.z }
    const turn = at.upright ? at.rotY * RAD : 0
    const half = { w: w / 2, d: d / 2 }
    const side = clickedSide(
      toObject(hit, origin, turn),
      half,
      h,
      toObject(camera.position, origin, turn),
    )
    const face = sideFace(side, half, h)
    const center = toWorld(face.center, origin, turn)
    const tip = toWorld({ x: face.normal.x, y: 0, z: face.normal.z }, { x: 0, y: 0, z: 0 }, turn)
    dispatch(
      setFocusTarget({
        artworkId: artwork.id,
        position: center,
        normal: { x: tip.x, y: 0, z: tip.z },
        width: face.width,
        height: h,
        object: true,
      }),
    )
  }

  const onPointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (onFloorDown) {
      onFloorDown(event, o.id)
      return
    }
    if (isEditMode) return
    event.stopPropagation()
    clearTimeout(pending.current ?? undefined)
    pending.current = null
    pressed.current = {
      x: event.clientX,
      y: event.clientY,
      at: Date.now(),
      hit: { x: event.point.x, y: event.point.y, z: event.point.z },
    }
    taps.down(event)
  }
  const onPointerUp = (event: ThreeEvent<PointerEvent>) => {
    if (isEditMode || !pressed.current) return
    event.stopPropagation()
    const { x, y, at: downAt, hit } = pressed.current
    pressed.current = null
    const still = Math.hypot(event.clientX - x, event.clientY - y) < taps.slop(CLICK_MAX_MOVE_PX)
    if (taps.ignored || !still || Date.now() - downAt > CLICK_MAX_MS) return
    if (taps.touch && taps.secondTap()) {
      openPage()
      return
    }
    pending.current = setTimeout(() => {
      pending.current = null
      comeNearer(hit)
    }, DOUBLE_TAP_MS)
  }
  const onDoubleClick = (event: ThreeEvent<MouseEvent>) => {
    if (isEditMode) return
    event.stopPropagation()
    // A finger's double tap is counted in onPointerUp (tapTracker).
    if (taps.touch) return
    clearTimeout(pending.current ?? undefined)
    pending.current = null
    openPage()
  }

  return (
    <group
      name={`floorObject-${o.id}`}
      {...transformOf(at, floorY)}
      scale={o.scale}
      userData={{ floorItemId: o.id }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      <primitive object={model} position={centered} />
    </group>
  )
}

/** The editor's blue (`--editor-row-selected-edge`) and the overhang's amber (`--studio-3d-caution-edge`). */
const PICKED = '#3b6fd8'
const CAUTION = '#c49a2c'

/** A box's 12 edges as line segments, around its center (m). */
function boxEdges(w: number, h: number, d: number): [number, number, number][] {
  const c = [-1, 1]
  const pts: [number, number, number][] = []
  for (const a of c)
    for (const b of c) {
      pts.push([-w / 2, (a * h) / 2, (b * d) / 2], [w / 2, (a * h) / 2, (b * d) / 2])
      pts.push([(a * w) / 2, -h / 2, (b * d) / 2], [(a * w) / 2, h / 2, (b * d) / 2])
      pts.push([(a * w) / 2, (b * h) / 2, -d / 2], [(a * w) / 2, (b * h) / 2, d / 2])
    }
  return pts
}

/**
 * The Floor view's picked items, their boxes outlined in the live 3D (the board's blue); amber when
 * one reaches past its face or under the floor.
 */
function Selection({
  placed,
  layout,
  sizes,
  floorY,
}: {
  placed: { item: FloorObject | FloorPedestal; at: Placed }[]
  layout: FloorLayout
  sizes: FloorSizes
  floorY: number
}) {
  const selectedIds = useSelector((state: RootState) => state.floor.selectedIds)
  return (
    <>
      {placed
        .filter(({ item }) => selectedIds.includes(item.id))
        .map(({ item, at }) => {
          const warn = overhangs(layout, item, sizes) || belowFloor(at)
          // A hair outside the box, so the lines never sink into its faces.
          const [w, h, d] = [at.size.w, at.size.h, at.size.d].map((cm) => cm / 100 + 0.004)
          return (
            <Line
              key={item.id}
              points={boxEdges(w, h, d)}
              segments
              color={warn ? CAUTION : PICKED}
              lineWidth={2}
              {...transformOf(at, floorY)}
              userData={{ bakeCaster: false }}
            />
          )
        })}
    </>
  )
}

/** "Person for scale": a 1.70 m figure where the plan shows it; never baked. */
function PersonForScale({ floorY }: { floorY: number }) {
  const { rooms } = useFloorRooms()
  const room = useSelector((state: RootState) => state.floor.room)
  const r = rooms[Math.min(room, rooms.length - 1)]
  if (!r) return null
  return (
    <group position={[r.centerX + 1.2, floorY, r.centerZ + 1.2]}>
      <mesh position={[0, 0.72, 0]} userData={{ bakeCaster: false }}>
        <capsuleGeometry args={[0.19, 1.06, 6, 16]} />
        <meshStandardMaterial color="#c8c8c4" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.58, 0]} userData={{ bakeCaster: false }}>
        <sphereGeometry args={[0.11, 16, 12]} />
        <meshStandardMaterial color="#c8c8c4" roughness={0.9} />
      </mesh>
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
  const isFloorView = useSelector((state: RootState) => state.floor.isFloorView)
  const person = useSelector((state: RootState) => state.floor.helpers.person)
  const sizes = useMemo(() => floorSizes(artworks), [artworks])
  const placed = useMemo(() => (layout ? placeAll(layout, sizes) : []), [layout, sizes])
  // The Floor view only opens in the editor: there, the items are picked and dragged.
  const composing = isFloorView
  const floorDown = useFloorDrag(composing ? (layout ?? null) : null, floorY)
  const onFloorDown = composing ? floorDown : undefined

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
      {isFloorView && layout && (
        <Selection placed={placed} layout={layout} sizes={sizes} floorY={floorY} />
      )}
      {isFloorView && person && <PersonForScale floorY={floorY} />}
      {placed.map(({ item, at }) => {
        if (item.kind === 'pedestal') {
          return (
            <Pedestal key={item.id} p={item} at={at} floorY={floorY} onFloorDown={onFloorDown} />
          )
        }
        const artwork = artworks?.[item.artworkId]
        if (!artwork || !started.has(artwork.modelUrl)) return null
        return (
          // Per Object, so a model still loading never hides the others.
          <Suspense key={item.id} fallback={null}>
            <FloorModel
              o={item}
              at={at}
              floorY={floorY}
              artwork={artwork}
              onFloorDown={onFloorDown}
            />
          </Suspense>
        )
      })}
    </group>
  )
}

export default FloorItems
