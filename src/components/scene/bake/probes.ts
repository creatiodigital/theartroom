import { DataUtils, Raycaster, Vector3 } from 'three'
import type { DataTexture, Mesh, MeshStandardMaterial, Object3D } from 'three'

import { GLASS_ON_SCREEN } from '@/components/scene/spaces/objects/Effects/bloomIntensity'

import { LUX_PER_UNIT } from './bakedLook'

/**
 * ⚠️ AR-169 calibration instrument (development, `BAKE_DEBUG`; plan
 * docs/superpowers/plans/2026-10-30-lighting-calibration.md, phase 1): reads the light a stored
 * bake put at named points, in lux, so the calibration compares numbers instead of screenshots.
 * Nothing on screen changes.
 *
 * A probe is a point on a surface and the normal facing into the room. It is raycast onto its
 * surface's scene mesh; the hit's UV in the lightmap's channel (walls and ceiling: our own
 * unwrap in `uv1`; the floor: its own `uv`) reads the map bilinearly, as the shader does. The maps
 * hold irradiance (three units, `LUX_PER_UNIT` lux each); the glass reports its radiance (cd/m²),
 * on screen and as the bake emitted it.
 */
export interface Probe {
  id: string
  position: [number, number, number]
  normal: [number, number, number]
  surface: 'wall' | 'ceiling' | 'floor' | 'glass'
}

export interface ProbeReading {
  id: string
  surface: Probe['surface']
  /** Irradiance (walls, ceiling, floor), lux per channel; the glass: luminance, cd/m². */
  rgb: [number, number, number] | null
  /** Rec. 709 luminance of `rgb`. */
  y: number | null
  /** The glass only: what the bake emitted (on screen it shows `GLASS_ON_SCREEN` of it). */
  bakedCdM2?: number
  error?: string
}

const SCENE_MESH: Record<Exclude<Probe['surface'], 'glass'>, string> = {
  wall: 'wall0',
  ceiling: 'ceiling',
  floor: 'floor',
}

const luminance = ([r, g, b]: [number, number, number]) => 0.2126 * r + 0.7152 * g + 0.0722 * b

/** Bilinear read of a half-float RGBA DataTexture at (u, v), clamped to the edge (flipY false). */
const sampleHalf = (texture: DataTexture, u: number, v: number): [number, number, number] => {
  const { data, width, height } = texture.image as {
    data: Uint16Array
    width: number
    height: number
  }
  const x = Math.min(Math.max(u * width - 0.5, 0), width - 1)
  const y = Math.min(Math.max(v * height - 0.5, 0), height - 1)
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(x0 + 1, width - 1)
  const y1 = Math.min(y0 + 1, height - 1)
  const fx = x - x0
  const fy = y - y0
  const at = (px: number, py: number, c: number) =>
    DataUtils.fromHalfFloat(data[(py * width + px) * 4 + c]!)
  return [0, 1, 2].map(
    (c) =>
      (at(x0, y0, c) * (1 - fx) + at(x1, y0, c) * fx) * (1 - fy) +
      (at(x0, y1, c) * (1 - fx) + at(x1, y1, c) * fx) * fy,
  ) as [number, number, number]
}

const ray = new Raycaster()

const readSurface = (scene: Object3D, probe: Probe): ProbeReading => {
  const base = { id: probe.id, surface: probe.surface, rgb: null, y: null }
  const mesh = scene.getObjectByName(SCENE_MESH[probe.surface as keyof typeof SCENE_MESH]) as
    | Mesh
    | undefined
  if (!mesh) return { ...base, error: 'no mesh' }
  const map = (mesh.material as MeshStandardMaterial).lightMap as DataTexture | null
  if (!map?.image || !(map.image as { data?: unknown }).data)
    return { ...base, error: 'no lightmap' }
  const normal = new Vector3(...probe.normal)
  ray.set(new Vector3(...probe.position).addScaledVector(normal, 0.1), normal.clone().negate())
  ray.far = 0.3
  const hit = ray.intersectObject(mesh, false)[0]
  const uv = hit && (map.channel === 1 ? hit.uv1 : hit.uv)
  if (!uv) return { ...base, error: 'no hit' }
  const rgb = sampleHalf(map, uv.x, uv.y).map((c) => c * LUX_PER_UNIT) as [number, number, number]
  return { ...base, rgb, y: luminance(rgb) }
}

const readGlass = (scene: Object3D, probe: Probe): ProbeReading => {
  const base = { id: probe.id, surface: probe.surface, rgb: null, y: null }
  let glass: Mesh | undefined
  scene.traverse((o) => {
    if (!glass && (o as Mesh).isMesh && /^windowGlass\d+$/.test(o.name)) glass = o as Mesh
  })
  if (!glass) return { ...base, error: 'no glass' }
  const material = glass.material as MeshStandardMaterial
  const rgb = material.emissive
    .toArray()
    .map((c) => c * material.emissiveIntensity * LUX_PER_UNIT) as [number, number, number]
  const y = luminance(rgb)
  return { ...base, rgb, y, bakedCdM2: y / GLASS_ON_SCREEN }
}

export const readProbes = (scene: Object3D, probes: Probe[]): ProbeReading[] =>
  probes.map((p) => (p.surface === 'glass' ? readGlass(scene, p) : readSurface(scene, p)))
