import { useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AddEquation,
  BackSide,
  BufferGeometry,
  CustomBlending,
  Float32BufferAttribute,
  Matrix4,
  OneFactor,
  ShaderMaterial,
  Vector2,
  Vector3,
  ZeroFactor,
  type Mesh,
  type MeshStandardMaterial,
  type Texture,
} from 'three'

import { useBakedLook } from './bakedLook'
import { spaceSunDirection, sunEnters } from './spaceSun'

/**
 * AR-169 (Eduardo 2026-10-31: "what about some volume light on the window?" → on S 3: "I love it…
 * keep it subtle"; `SUNBEAM_STRENGTH`, `?sunbeam=S` compares):
 * the sun's beam through each window it enters, made visible by a faint haze — a volume from the
 * glass down to the floor along the bake's own sun (the space's one sun, `spaceSun`). Where the beam is lit comes from the bake itself: a point is lit
 * when its sun ray lands on the floor's baked sun patch (read from the floor's lightmap), so the
 * window bars cut the beam exactly as they cut the patch, and the blinds (`daylightLevel`) dim it.
 * Display only: the room's light and the bake are untouched; nothing is drawn in bake mode.
 *
 * Cost: one transparent box per window; a few lightmap reads per pixel where a beam is on screen.
 * It keeps the artwork marker (alpha untouched), so the file-exact pass still restores every image
 * (a beam in front of an artwork is cut there).
 */

/** Haze density at S = 1 (per meter): a 2 m beam at the patch's ~3,000 lx adds ~0.1 before the camera. */
const HAZE = 0.015
const MAX_WINDOWS = 4
const STEPS = 32
/** Floor irradiance (three units, ~71 lx each) above which a point counts as sun patch. */
const PATCH_FROM = 12
const PATCH_FULL = 25

interface WindowBeam {
  center: Vector3
  /** Inward normal (into the room). */
  normal: Vector3
  /** Half-extent vectors of the glass, horizontal and vertical. */
  u: Vector3
  v: Vector3
  /** Where the sun travels (into the room, downward). */
  sun: Vector3
}

const VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4( position, 1.0 );
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

const FRAGMENT = /* glsl */ `
#define MAX_WINDOWS ${MAX_WINDOWS}
#define STEPS ${STEPS}
uniform sampler2D floorLight;
uniform mat4 floorInverse;
uniform vec2 floorSize;
uniform float floorY;
uniform int windowCount;
uniform vec3 wCenter[ MAX_WINDOWS ];
uniform vec3 wNormal[ MAX_WINDOWS ];
uniform vec3 wU[ MAX_WINDOWS ];
uniform vec3 wV[ MAX_WINDOWS ];
uniform vec3 wSun[ MAX_WINDOWS ];
uniform float haze;
varying vec3 vWorld;

float hg( float c, float g ) {
  float g2 = g * g;
  return ( 1.0 - g2 ) / ( 12.566371 * pow( 1.0 + g2 - 2.0 * g * c, 1.5 ) );
}

void main() {
  vec3 toExit = vWorld - cameraPosition;
  float total = length( toExit );
  vec3 dir = toExit / total;
  float len = min( total, 12.0 );
  vec3 start = vWorld - dir * len;
  float dt = len / float( STEPS );
  // Interleaved gradient noise: the steps' offset per pixel (no banding).
  float jitter = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
  vec3 sum = vec3( 0.0 );
  for ( int i = 0; i < STEPS; i++ ) {
    vec3 p = start + dir * ( dt * ( float( i ) + jitter ) );
    if ( p.y <= floorY ) continue;
    for ( int w = 0; w < MAX_WINDOWS; w++ ) {
      if ( w >= windowCount ) break;
      vec3 s = wSun[ w ];
      float inside = dot( p - wCenter[ w ], wNormal[ w ] );
      if ( inside <= 0.0 ) continue;
      // Back along the sun to the glass: within its rectangle?
      vec3 x = p - s * ( inside / dot( s, wNormal[ w ] ) ) - wCenter[ w ];
      if ( abs( dot( x, wU[ w ] ) ) > dot( wU[ w ], wU[ w ] ) ) continue;
      if ( abs( dot( x, wV[ w ] ) ) > dot( wV[ w ], wV[ w ] ) ) continue;
      // On along the sun to the floor: is it the baked sun patch there?
      vec3 f = p + s * ( ( p.y - floorY ) / -s.y );
      vec4 local = floorInverse * vec4( f, 1.0 );
      vec2 uv = local.xy / floorSize + 0.5;
      vec3 e = texture2D( floorLight, uv ).rgb;
      float sunlit = smoothstep( ${PATCH_FROM.toFixed(1)}, ${PATCH_FULL.toFixed(1)}, dot( e, vec3( 0.2126, 0.7152, 0.0722 ) ) );
      sum += e * sunlit * hg( dot( s, -dir ), 0.4 ) * dt;
    }
  }
  gl_FragColor = vec4( sum * haze, 0.0 );
}
`

/** The windows' glass as the bake's sun portals (`bakeJob`): centre, inward normal, half-extents. */
const findWindows = (root: Mesh['parent'], elevationDeg: number, azimuthDeg: number) => {
  const windows: (WindowBeam & { area: number })[] = []
  root?.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh || !/^windowGlass\d+$/.test(mesh.name) || windows.length >= MAX_WINDOWS) return
    mesh.updateWorldMatrix(true, false)
    mesh.geometry.computeBoundingBox()
    const box = mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld)
    const center = box.getCenter(new Vector3())
    const size = box.getSize(new Vector3())
    // Its front face (as the bake's emitters face): the area-weighted triangle normal.
    const pos = mesh.geometry.getAttribute('position')
    const index = mesh.geometry.getIndex()
    const count = index ? index.count : pos.count
    const at = (i: number) =>
      new Vector3()
        .fromBufferAttribute(pos, index ? index.getX(i) : i)
        .applyMatrix4(mesh.matrixWorld)
    const facing = new Vector3()
    for (let i = 0; i + 2 < count; i += 3) {
      const a = at(i)
      facing.add(
        at(i + 1)
          .sub(a)
          .cross(at(i + 2).sub(a)),
      )
    }
    if (mesh.matrixWorld.determinant() < 0) facing.negate()
    const acrossX = size.x < size.z
    const normal = acrossX
      ? new Vector3(Math.sign(facing.x) || 1, 0, 0)
      : new Vector3(0, 0, Math.sign(facing.z) || 1)
    windows.push({
      center,
      normal,
      u: acrossX ? new Vector3(0, 0, size.z / 2) : new Vector3(size.x / 2, 0, 0),
      v: new Vector3(0, size.y / 2, 0),
      sun: new Vector3(),
      area: size.y * (acrossX ? size.z : size.x),
    })
  })
  // The space's one sun (`spaceSun`, as the bake aims it): a beam only where it comes in.
  const sun = spaceSunDirection(
    windows.map((w) => ({ inward: w.normal, area: w.area })),
    elevationDeg,
    azimuthDeg,
  )
  if (!sun) return []
  return windows
    .filter((w) => sunEnters(sun, w.normal))
    .map((w) => ({ ...w, sun: sun.clone().normalize() }))
}

/** The beam's box: the glass rectangle (1 cm into the room) and its landing on the floor (1 cm up). */
const beamGeometry = (w: WindowBeam, floorY: number): BufferGeometry => {
  const top = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([a, b]) =>
    w.center
      .clone()
      .addScaledVector(w.u, a! * 1.02)
      .addScaledVector(w.v, b! * 1.02)
      .addScaledVector(w.normal, 0.01),
  )
  const bottom = top.map((c) => c.clone().addScaledVector(w.sun, (c.y - floorY - 0.01) / -w.sun.y))
  const corners = [...top, ...bottom]
  const centroid = corners.reduce((sum, c) => sum.add(c), new Vector3()).divideScalar(8)
  const faces = [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [1, 2, 6, 5],
    [2, 3, 7, 6],
    [3, 0, 4, 7],
  ]
  const positions: number[] = []
  for (const face of faces) {
    const [a, c] = [corners[face[0]!]!, corners[face[2]!]!]
    let [b, d] = [corners[face[1]!]!, corners[face[3]!]!]
    const n = b.clone().sub(a).cross(c.clone().sub(a))
    // Outward winding: the face's normal points away from the box's centre.
    if (n.dot(a.clone().sub(centroid)) < 0) [b, d] = [d, b]
    for (const p of [a, b, c, a, c, d]) positions.push(p.x, p.y, p.z)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  return geometry
}

export const SunBeams = ({ strength }: { strength: number }) => {
  const scene = useThree((s) => s.scene)
  const look = useBakedLook()
  const [beams, setBeams] = useState<{ geometry: BufferGeometry; material: ShaderMaterial }[]>([])
  const frames = useRef(0)
  const lightMap = useRef<Texture | null>(null)
  const elevation = look.baked ? look.space.sunElevationDeg : 0
  const azimuth = look.baked ? look.space.sunAzimuthDeg : 0
  const uniforms = useMemo(
    () => ({
      floorLight: { value: null as Texture | null },
      floorInverse: { value: new Matrix4() },
      floorSize: { value: new Vector2(1, 1) },
      floorY: { value: 0 },
      windowCount: { value: 0 },
      wCenter: { value: Array.from({ length: MAX_WINDOWS }, () => new Vector3()) },
      wNormal: { value: Array.from({ length: MAX_WINDOWS }, () => new Vector3()) },
      wU: { value: Array.from({ length: MAX_WINDOWS }, () => new Vector3()) },
      wV: { value: Array.from({ length: MAX_WINDOWS }, () => new Vector3()) },
      wSun: { value: Array.from({ length: MAX_WINDOWS }, () => new Vector3()) },
      haze: { value: HAZE * strength },
    }),
    [strength],
  )

  // Built once the floor carries its baked light (a stored bake, or a finished quick bake).
  useFrame(() => {
    if (frames.current++ % 20 !== 0) return
    const floor = scene.getObjectByName('floor') as Mesh | undefined
    const map = (floor?.material as MeshStandardMaterial | undefined)?.lightMap ?? null
    if (!floor || !map || map === lightMap.current) return
    lightMap.current = map
    floor.updateWorldMatrix(true, false)
    const params = (
      floor.geometry as BufferGeometry & { parameters?: { width: number; height: number } }
    ).parameters
    const windows = findWindows(scene, elevation, azimuth)
    const floorY = new Vector3().setFromMatrixPosition(floor.matrixWorld).y
    uniforms.floorLight.value = map
    uniforms.floorInverse.value.copy(floor.matrixWorld).invert()
    uniforms.floorSize.value.set(params?.width ?? 1, params?.height ?? 1)
    uniforms.floorY.value = floorY
    uniforms.windowCount.value = windows.length
    windows.forEach((w, i) => {
      uniforms.wCenter.value[i]!.copy(w.center)
      uniforms.wNormal.value[i]!.copy(w.normal)
      uniforms.wU.value[i]!.copy(w.u)
      uniforms.wV.value[i]!.copy(w.v)
      uniforms.wSun.value[i]!.copy(w.sun)
    })
    beams.forEach((b) => {
      b.geometry.dispose()
      b.material.dispose()
    })
    setBeams(
      windows.map((w) => ({
        geometry: beamGeometry(w, floorY),
        material: new ShaderMaterial({
          uniforms,
          vertexShader: VERTEX,
          fragmentShader: FRAGMENT,
          side: BackSide,
          transparent: true,
          depthWrite: false,
          // Light added; the destination's alpha (the artwork marker) kept.
          blending: CustomBlending,
          blendEquation: AddEquation,
          blendSrc: OneFactor,
          blendDst: OneFactor,
          blendSrcAlpha: ZeroFactor,
          blendDstAlpha: OneFactor,
        }),
      })),
    )
  })

  return (
    <>
      {beams.map((b, i) => (
        <mesh
          key={i}
          name="sunBeam"
          geometry={b.geometry}
          material={b.material}
          renderOrder={10}
          frustumCulled={false}
          raycast={() => null}
        />
      ))}
    </>
  )
}
