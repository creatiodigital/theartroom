import { Component, useLayoutEffect, useMemo, type ReactNode } from 'react'
import { useGLTF } from '@react-three/drei'
import {
  BufferGeometry,
  Color,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  SRGBColorSpace,
  Vector3,
  type Box3,
  type WebGLProgramParametersWithUniforms,
} from 'three'

import { assetUrl } from '@/lib/assetUrl'
import { BAKE_DEBUG } from '@/components/scene/bake/bakedLook'
import { GLASS_ON_SCREEN } from '@/components/scene/spaces/objects/Effects/bloomIntensity'
import { countNodes } from '@/components/scene/spaces/objects/nodeIndices'
import { useDisposable } from '@/components/scene/spaces/objects/useDisposable'
import { isFallbackTexture, useResilientTexture } from '@/components/scene/useResilientTexture'

/**
 * AR-170 — Eduardo 2026-11-01: "give the impression there are buildings behind, not super detailed
 * models"; then "all windows will now show a building behind" (so the glass is clear: no tint, its
 * color option hidden). A facade across the street at its true distance (research 2026-10-31 §2,
 * option d): the panorama tried on 2026-10-31 sat at infinity and slid the wrong way as the visitor
 * walked; a facade at its depth moves against the window frame like the real building. On screen
 * only: the glass's emissive values (the bake's daylight) are untouched and the exterior is never
 * in a bake (not on the bake page), so every stored bake stays valid.
 *
 * The facade is a model with the photo on it (`FACADES`), its depth real geometry (Eduardo: "my issue
 * is the depth"; "all flat looks really cheap"). Before it, a flat photo with parallax occlusion
 * (a height map): its railings showed twice and speckled, or smeared at a slant (2026-11-02 on
 * staging, "it's a real mess") — a height map cannot hold see-through ironwork.
 *
 * The facade is in shade (the sun comes in over its roof) and the room's camera shows it: its stone
 * at STONE_SHADE × the sky's radiance, through exposure, white balance and the tone curve. Seen
 * through the glass, as in a photo from inside (Eduardo's reference: "the building behind is a
 * little blurry, due to the glass itself"): a little out of focus and veiled by the daylight the
 * glass scatters.
 *
 * As Eduardo approved it (2026-11-01, "looks perfect now"), the same in every space and window:
 * - `FACADES`, a facade across each street, mirrored copies either side making the row: the first
 *   street (its first pane's) haussmann4, every other haussmann6 — Paris and Madrid face one way,
 *   Vienna's second room another (Eduardo 2026-11-02: "in vienna space we want 2 different
 *   facades"; its second photo of 2026-11-01, flat, he had turned down).
 * - STREET_BELOW: the room's floor over the street — a fourth floor (Eduardo: "pretend our gallery
 *   is on the 3rd or 4th floor", so the view never reaches the street).
 * - FACADE_DISTANCE: glass to facade, a narrow Paris street. The sun comes straight in at 35°: from
 *   the window's sill (16.6 m over the street) its ray clears a 24 m Haussmann roofline from 11 m
 *   out (from a third floor it needed 15 m).
 * - GLASS_BLUR, GLASS_VEIL: Eduardo 2026-11-01, of sharp / 1.5 + 0.2 / 2.5 + 0.35: "I prefer 2 but a
 *   little less blurry, between 1 and 2, more towards 2" — both about 70 % of the way (1 + 0.15);
 *   then "amazing effect… the photo is perhaps now too blurry" — blur 0.5; then, with the sharper
 *   photo, "make the glass clearer, it's too blurred now" — blur 0.25, veil 0.1.
 * - SKY: a clear sky over the roofs, by the direction it is seen in. On screen only: the bake's
 *   daylight stays white.
 *
 * In development and staging (`BAKE_DEBUG`), to compare: `?exterior=0` the frosted glass as before.
 *
 * Keyed on the model, never the space: every pane (`windowGlass{i}`) shows a street, out the way
 * its sky panel (`windowLight{j}`, within 3 m) faces — or, with none (Madrid), away from the
 * shell's (`wall0`) middle.
 */
export const exteriorShown = (): boolean =>
  typeof window !== 'undefined' &&
  !(BAKE_DEBUG && new URLSearchParams(window.location.search).get('exterior') === '0')

/** The room's floor over the street (m). */
const STREET_BELOW = 16
/** Glass to facade (m). */
const FACADE_DISTANCE = 12
/** The photo's mip bias through the glass: 0 sharp, each step about twice as soft. */
const GLASS_BLUR = 0.25
/** The share of the sky's light the glass lays over the view. */
const GLASS_VEIL = 0.1

/**
 * The sky at the horizon and overhead, × today's frosted glass (the sky as the glass showed it):
 * whitish haze low, a light blue up high.
 */
const SKY = { horizon: [0.92, 0.96, 1.0], zenith: [0.42, 0.58, 0.92] } as const

/**
 * The facades, each built from one of Eduardo's photos in Blender by
 * `.superpowers/ar170/tools/facade_build.py` with its `facades/<name>.py` (Eduardo 2026-11-02:
 * "create a facade… you can use that same exact photo as model, and textures"; each its own scene in
 * his ~/Desktop/haussmann.blend). Real geometry from the photo's measured grid, the photo projected
 * straight on (head-on it is the photo), faces turned away one plain stone tone from it, a shade in
 * their vertex colours. Both at the same scale (14.9 m per 1000 px):
 * - haussmann4 (2026-11-01; 1000 × 1500 px, 14.9 m wide): windows set back 25 cm (French windows
 *   down to their balcony floors), balcony slabs, consoles, cornices and pediments out 20–68 cm, thin
 *   stone parapets, the bay 60 cm out, the mansard sloping back with its dormers and chimneys. Its
 *   lowest 4.5 m repeat once down to the street.
 * - haussmann6 (2026-11-02; 1200 × 1600 px): the main building only, x 98–1112 (Eduardo: "only
 *   capture the main building… not the adjacent ones"), 15.1 m wide, its party walls joining the
 *   mirrored copies; window balconettes with their flower boxes, the second floor's balcony, the
 *   shop fronts — down to the pavement, nothing repeated.
 *
 * `model` (glTF, y up, x across, +z toward the street): `facade` and `railings`, the latter cut-out
 * planes at the slabs' front edges, so the ironwork stands in front of the wall and the wall shows
 * between its bars (and the stone balustrades' faces and the flower boxes, opaque).
 *
 * `wall`: the photo with the railings, balustrades and flower boxes taken off (the wall behind each
 * continued from the rows above it) and its sky cut out; `railing`: the ironwork alone, a soft alpha
 * (thin bars fade in as in the photo), and the balustrades and flower boxes — both by
 * `.superpowers/ar170/tools/make_textures.py`. `width`: the model's, its copies' spacing; `bottom`:
 * the photo's lower edge over the street, the model's origin; `stone`: the lit stone's linear
 * luminance in the photo — photo 4's 75th percentile (not the dark windows), photo 6's that × their
 * warm stone's medians (0.393 / 0.348), so both streets' stone shows alike.
 *
 * On R2 (`app/assets/views/`, `scripts/upload-3d-assets.ts`), like every 3D asset. The CDN caches
 * them as immutable: a file rebuilt under its name bumps its `?v=`.
 */
const FACADES = [
  {
    model: '/assets/views/haussmann4-facade.glb?v=3',
    wall: '/assets/views/haussmann4-wall.webp?v=3',
    railing: '/assets/views/haussmann4-railing.webp?v=3',
    width: 14.9,
    bottom: 4.5,
    stone: 0.61,
  },
  {
    model: '/assets/views/haussmann6-facade.glb',
    wall: '/assets/views/haussmann6-wall.webp?v=2',
    railing: '/assets/views/haussmann6-railing.webp',
    width: 15.109,
    bottom: 0,
    stone: 0.69,
  },
] as const
type Facade = (typeof FACADES)[number]
/**
 * A shaded limestone facade's stone over the sky's radiance: albedo ≈ 0.6 under about half the
 * sky, ρ·E/π ≈ 0.3 (research §2). (With the first photo it shows as before: 0.2 × its mean.)
 */
const STONE_SHADE = 0.3
/** The street in shade: asphalt albedo ≈ 0.15 under half the sky. */
const STREET_SHADE = 0.075
/**
 * The copies of the facade across the row, mirrored every other one: a middle one, five either side
 * (~165 m). Eduardo 2026-11-02: "make the model twice wide, so if angled we don't see the end of it
 * from the window… we don't want to see any of the ends". A window's reveal keeps a sightline within
 * about 80° of straight out (its width over the wall's depth), which meets the facade at most ~70 m
 * along at 12 m; three copies (45 m) ended within view. Odd, so a whole copy, not a seam, faces each
 * window.
 */
const FACADE_COPIES = 11
/**
 * The sky behind the roofs: a plane far enough for no parallax against them and wide enough that no
 * sightline through a window passes its edge (±900 m at 92 m: 84°), inside the camera's 1000 m.
 */
const SKY_PLANE = { distance: 80, width: 1800, height: 700 }
/** A sky panel this close to a pane is that window's sky (as `brightenWindows` reads it). */
const PANEL_REACH = 3

type Nodes = Record<string, Mesh & { geometry: BufferGeometry }>

export const nodeBox = (node: Mesh & { geometry: BufferGeometry }): Box3 => {
  if (!node.geometry.boundingBox) node.geometry.computeBoundingBox()
  const local = new Matrix4().compose(node.position, node.quaternion, node.scale)
  return node.geometry.boundingBox!.clone().applyMatrix4(local)
}

/** The sky panels right behind a pane: hidden on screen while the street shows. */
export const panelsBehindGlass = (nodes: Nodes): Set<number> => {
  const panes = Array.from({ length: countNodes(nodes, 'windowGlass') }, (_, i) =>
    nodes[`windowGlass${i}`] ? nodeBox(nodes[`windowGlass${i}`]).getCenter(new Vector3()) : null,
  )
  const behind = new Set<number>()
  for (let j = 0; j < countNodes(nodes, 'windowLight'); j++) {
    const panel = nodes[`windowLight${j}`]
    if (!panel) continue
    const at = nodeBox(panel).getCenter(new Vector3())
    if (panes.some((pane) => pane && pane.distanceTo(at) < PANEL_REACH)) behind.add(j)
  }
  return behind
}

/** The room's middle: the shell's (`wall0`), or null. */
export const roomMiddle = (nodes: Nodes): Vector3 | null =>
  nodes.wall0 ? nodeBox(nodes.wall0).getCenter(new Vector3()) : null

/**
 * One street per way the panes face, in the order of their first pane: their mean centre, the
 * horizontal way out — toward the pane's sky panel, or away from the room's middle — and the panes
 * (`windowGlass{i}`). In the model's frame (the nodes').
 */
export const streets = (
  nodes: Nodes,
  room: Vector3 | null,
): { center: Vector3; outward: Vector3; panes: number[] }[] => {
  const facings: { center: Vector3; outward: Vector3; panes: number[] }[] = []
  const panels = Array.from({ length: countNodes(nodes, 'windowLight') }, (_, j) =>
    nodes[`windowLight${j}`] ? nodeBox(nodes[`windowLight${j}`]).getCenter(new Vector3()) : null,
  )
  for (let i = 0; i < countNodes(nodes, 'windowGlass'); i++) {
    const node = nodes[`windowGlass${i}`]
    if (!node) continue
    const box = nodeBox(node)
    const center = box.getCenter(new Vector3())
    const panel = panels.find((p) => p && p.distanceTo(center) < PANEL_REACH) ?? null
    // Out: past the pane, away from the room's middle (a point outside it, standing in for a panel).
    const beyond = panel ?? (room ? center.clone().multiplyScalar(2).sub(room) : null)
    if (!beyond) continue
    // The pane's normal is its thinnest horizontal side; out is the side `beyond` is on.
    const size = box.getSize(new Vector3())
    const outward =
      size.x < size.z
        ? new Vector3(Math.sign(beyond.x - center.x) || 1, 0, 0)
        : new Vector3(0, 0, Math.sign(beyond.z - center.z) || 1)
    const same = facings.find((f) => f.outward.dot(outward) > 0.99)
    if (same) {
      same.center
        .multiplyScalar(same.panes.length)
        .add(center)
        .divideScalar(same.panes.length + 1)
      same.panes.push(i)
    } else facings.push({ center, outward, panes: [i] })
  }
  return facings
}

/** The photo sampled out of focus (`exteriorBlur`: mip bias). */
const FLAT_MAP = /* glsl */ `#ifdef USE_MAP
	diffuseColor *= texture2D( map, vMapUv, exteriorBlur );
#endif`

/** Seen through the glass: the photo a little out of focus, the sky's light laid over it. */
const throughGlass =
  (blur: number, veil: number, veilColor: Color) =>
  (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.exteriorBlur = { value: blur }
    shader.uniforms.exteriorVeil = { value: veil }
    shader.uniforms.exteriorVeilColor = { value: veilColor }
    shader.fragmentShader = `uniform float exteriorBlur;
uniform float exteriorVeil;
uniform vec3 exteriorVeilColor;
${shader.fragmentShader}`
      .replace('#include <map_fragment>', FLAT_MAP)
      .replace(
        '#include <opaque_fragment>',
        '#include <opaque_fragment>\n\tgl_FragColor.rgb = mix( gl_FragColor.rgb, exteriorVeilColor, exteriorVeil );',
      )
  }

/** The sky by the direction it is seen in: horizon at eye level, zenith from about 55° up. */
const skyGradient =
  (horizon: Color, zenith: Color) => (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.skyHorizon = { value: horizon }
    shader.uniforms.skyZenith = { value: zenith }
    shader.vertexShader = `varying vec3 vSkyWorld;\n${shader.vertexShader}`.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\n  vSkyWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;',
    )
    shader.fragmentShader = `varying vec3 vSkyWorld;
uniform vec3 skyHorizon;
uniform vec3 skyZenith;
${shader.fragmentShader}`.replace(
      '#include <opaque_fragment>',
      `float up = smoothstep( 0.0, 0.8, normalize( vSkyWorld - cameraPosition ).y );
	gl_FragColor = vec4( mix( skyHorizon, skyZenith, up ), 1.0 );`,
    )
  }

interface StreetProps {
  /** The facade across this street (`FACADES`). */
  building: Facade
  center: Vector3
  outward: Vector3
  /** The room's middle (the shell's), or null. */
  room: Vector3 | null
  /** The room's floor (m). */
  floor: number
  /** The sky's radiance in the bake. */
  sky: Color
  /** Once its facade has loaded. */
  onShown: () => void
}

/** One street: the facade across it, the street below, the sky over the roofs. */
const Street: React.FC<StreetProps> = ({
  building,
  center,
  outward,
  room,
  floor,
  sky,
  onShown,
}) => {
  const { nodes } = useGLTF(assetUrl(building.model))
  const { wall, railing } = useResilientTexture({
    wall: assetUrl(building.wall),
    railing: assetUrl(building.railing),
  })
  // A map that failed for good comes back as the loader's shared stand-in, never to be changed:
  // without the wall no street (the glass stays as it was), without the railing no ironwork.
  const loaded = !isFallbackTexture(wall)
  const ironwork = loaded && !isFallbackTexture(railing)
  const facade = (nodes.facade as Mesh | undefined)?.geometry ?? null
  const railings = (nodes.railings as Mesh | undefined)?.geometry ?? null

  // On screen the sky shows about as bright as today's frosted glass (its emissive × 2), shaded
  // from the horizon up (`SKY`).
  const skyLook = useMemo(() => {
    const shown = sky.clone().multiplyScalar(GLASS_ON_SCREEN * 2)
    return skyGradient(
      shown.clone().multiply(new Color(...SKY.horizon)),
      shown.clone().multiply(new Color(...SKY.zenith)),
    )
  }, [sky])
  const streetColor = useMemo(() => sky.clone().multiplyScalar(STREET_SHADE), [sky])
  const glass = useMemo(() => throughGlass(GLASS_BLUR, GLASS_VEIL, sky), [sky])
  // The model's materials: unlit, the photo × the stone's shade × each face's own (vertex colours).
  // The maps follow glTF's uv (no flip).
  const stone = useMemo(() => {
    if (!loaded || !facade) return null
    for (const map of ironwork ? [wall, railing] : [wall]) {
      map.colorSpace = SRGBColorSpace
      map.flipY = false
      map.needsUpdate = true
    }
    const color = sky.clone().multiplyScalar(STONE_SHADE / building.stone)
    const shared = { color, vertexColors: true }
    const wallMaterial = new MeshBasicMaterial({ ...shared, map: wall, alphaTest: 0.5 })
    const ironMaterial =
      ironwork && railings
        ? new MeshBasicMaterial({
            ...shared,
            map: railing,
            transparent: true,
            depthWrite: false,
            alphaTest: 0.02,
          })
        : null
    for (const material of [wallMaterial, ironMaterial]) {
      if (!material) continue
      material.onBeforeCompile = glass
      material.customProgramCacheKey = () => 'exterior-glass'
    }
    return { wall: wallMaterial, iron: ironMaterial }
  }, [loaded, ironwork, facade, railings, wall, railing, sky, glass, building.stone])
  useDisposable(stone?.wall)
  useDisposable(stone?.iron)
  useLayoutEffect(() => {
    if (stone) onShown()
  }, [stone, onShown])
  if (!stone || !facade) return null

  const yaw = Math.atan2(-outward.x, -outward.z)
  // Seen from inside, the street lies on the far side of the window from the room's middle: the
  // facade's middle copy goes where the line from the room's middle through the window meets it —
  // its mirrored seams out of the usual view — yet always 2.5 m or more either side of the window,
  // so a visitor looking straight out never sees one.
  let along = 0
  if (room) {
    const lateral = (center.x - room.x) * Math.cos(yaw) - (center.z - room.z) * Math.sin(yaw)
    const depth = (center.x - room.x) * outward.x + (center.z - room.z) * outward.z
    const reach = Math.max(0, building.width / 2 - 2.5)
    along = depth > 0 ? Math.max(-reach, Math.min(reach, (lateral * FACADE_DISTANCE) / depth)) : 0
  }
  const copies = Array.from({ length: FACADE_COPIES }, (_, i) => i - (FACADE_COPIES - 1) / 2)
  return (
    <group
      name="exteriorStreet"
      // Local −z is out of the window; y 0 is the street.
      position={[center.x, floor - STREET_BELOW, center.z]}
      rotation={[0, yaw, 0]}
    >
      {copies.map((k) => (
        <group
          key={k}
          // The wall's face at the facade's distance, the photo's lower edge at its height.
          position={[along + k * building.width, building.bottom, -FACADE_DISTANCE]}
          scale={[k % 2 === 0 ? 1 : -1, 1, 1]}
        >
          <mesh geometry={facade} material={stone.wall} />
          {railings && stone.iron && <mesh geometry={railings} material={stone.iron} />}
        </group>
      ))}
      <mesh position={[along, 0, -FACADE_DISTANCE / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[building.width * FACADE_COPIES, FACADE_DISTANCE]} />
        <meshBasicMaterial
          color={streetColor}
          onBeforeCompile={glass}
          customProgramCacheKey={() => 'exterior-glass'}
        />
      </mesh>
      <mesh position={[0, 100, -FACADE_DISTANCE - SKY_PLANE.distance]}>
        <planeGeometry args={[SKY_PLANE.width, SKY_PLANE.height]} />
        <meshBasicMaterial onBeforeCompile={skyLook} customProgramCacheKey={() => 'exterior-sky'} />
      </mesh>
    </group>
  )
}

/** A facade that cannot load leaves the glass as it was — never the room (the HDRI's way). */
class StreetErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error) {
    console.warn('The street view failed to load; the windows keep their glass:', error.message)
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

interface ExteriorViewProps {
  nodes: Nodes
  /** The space's window brightness and daylight gain: the sky's radiance in the bake. */
  windowIntensity: number
  daylightGain: number
  /** Once every street's facade has loaded: the glass may stop drawing. */
  onShown: () => void
}

const ExteriorView: React.FC<ExteriorViewProps> = ({
  nodes,
  windowIntensity,
  daylightGain,
  onShown,
}) => {
  // The sky's radiance in the bake: the glass's emissive (white × intensity × 0.3) × the gain. Clear
  // glass: the street is not tinted by the stored glass color (hidden, kept — LightingPanel).
  const sky = useMemo(
    () => new Color(1, 1, 1).multiplyScalar(windowIntensity * 0.3 * daylightGain),
    [windowIntensity, daylightGain],
  )
  const floor = nodes.floor0 ? nodeBox(nodes.floor0).max.y : 0
  const room = useMemo(() => roomMiddle(nodes), [nodes])
  const rows = useMemo(() => streets(nodes, room), [nodes, room])
  // The glass stops drawing once every street has its facade: one whose maps never load leaves the
  // glass of every window as it was, never a pane with nothing behind it.
  const streetShown = useMemo(() => {
    const shown = new Set<number>()
    return rows.map((_, i) => () => {
      shown.add(i)
      if (shown.size === rows.length) onShown()
    })
  }, [rows, onShown])

  return (
    <StreetErrorBoundary>
      {rows.map(({ center, outward }, i) => (
        <Street
          key={`exterior-${i}`}
          // The first street haussmann4, any other haussmann6.
          building={FACADES[Math.min(i, FACADES.length - 1)]}
          center={center}
          outward={outward}
          room={room}
          floor={floor}
          sky={sky}
          onShown={streetShown[i]}
        />
      ))}
    </StreetErrorBoundary>
  )
}

export default ExteriorView
