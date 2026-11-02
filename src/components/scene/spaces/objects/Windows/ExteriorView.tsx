import { useLayoutEffect, useMemo } from 'react'
import {
  BufferGeometry,
  Color,
  Matrix4,
  Mesh,
  MirroredRepeatWrapping,
  SRGBColorSpace,
  Vector2,
  Vector3,
  type Box3,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from 'three'

import { assetUrl } from '@/lib/assetUrl'
import { BAKE_DEBUG } from '@/components/scene/bake/bakedLook'
import { GLASS_ON_SCREEN } from '@/components/scene/spaces/objects/Effects/bloomIntensity'
import { countNodes } from '@/components/scene/spaces/objects/nodeIndices'
import { isFallbackTexture, useResilientTexture } from '@/components/scene/useResilientTexture'

/**
 * AR-170 — Eduardo 2026-11-01: "give the impression there are buildings behind, not super detailed
 * models"; then "all windows will now show a building behind" (so the glass is clear: no tint, its
 * color option hidden). A facade photo on a plane across the street at its true distance (research
 * 2026-10-31 §2, option d): the panorama tried on 2026-10-31 sat at infinity and slid the wrong way
 * as the visitor walked; a plane at its depth moves against the window frame like the real
 * building. On screen only: the glass's emissive values (the bake's daylight) are untouched and the
 * exterior is never in a bake (not on the bake page), so every stored bake stays valid.
 *
 * The facade is in shade (the sun comes in over its roof) and the room's camera shows it: its stone
 * at STONE_SHADE × the sky's radiance, through exposure, white balance and the tone curve. Seen
 * through the glass, as in a photo from inside (Eduardo's reference: "the building behind is a
 * little blurry, due to the glass itself"): a little out of focus and veiled by the daylight the
 * glass scatters.
 *
 * As Eduardo approved it (2026-11-01, "looks perfect now"), the same in every space and window:
 * - `FACADE` across every street, mirrored copies either side making the row. Vienna's second room
 *   (its windows face another way) had its own photo for a day; Eduardo 2026-11-02: "I don't like
 *   at all the second image. So let's use the same we used on paris… Same distance" — "in vienna
 *   model we will have twice the same image in all window views".
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
 * - The facade's relief (Eduardo, on a flat photo seen at a slant: "my issue is the depth").
 *
 * In development and staging (`BAKE_DEBUG`), to compare: `?exterior=0` the frosted glass as before,
 * `?exteriordepth=0` the facade flat.
 *
 * Keyed on the model, never the space: every pane (`windowGlass{i}`) shows a street, out the way
 * its sky panel (`windowLight{j}`, within 3 m) faces — or, with none (Madrid), away from the
 * shell's (`wall0`) middle.
 */
export const exteriorShown = (): { relief: boolean } | null => {
  if (typeof window === 'undefined') return null
  const query = BAKE_DEBUG ? new URLSearchParams(window.location.search) : null
  if (query?.get('exterior') === '0') return null
  return { relief: query?.get('exteriordepth') !== '0' }
}

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
 * The facade: haussmann4 (Eduardo's, 2026-11-01), a 1000 × 1500 px photo. Scale from the floor
 * pitch (≈ 3.1 m a storey); `bottom`: the photo's lower edge over the street (continuous balconies
 * on the 2nd and 5th floors place it); `stone`: its 75th-percentile linear luminance (the lit
 * stone, not the dark windows). `-cut`: the photo's own sky cut out (flood fill), ours behind.
 *
 * `depth`: the facade's relief, drawn on the photo's measured grid
 * (`.superpowers/ar170/tools/depth4.mjs`). Red: the solid relief in metres toward the street,
 * RELIEF_IN … RELIEF_OUT over 0 … 255 — windows set back 25 cm, the mansard sloping back to 0.6 m,
 * cornices and pediments out 20–35 cm, balcony slabs 55–60 cm. Green, blue: the ironwork of the
 * railings (RAIL_OUT) and balconettes (BALCONETTE_OUT) — thin layers a ray passes through between
 * the bars (as solids they read as dark slabs at a slant).
 *
 * On R2 (`app/assets/views/`, `scripts/upload-3d-assets.ts`), like every 3D asset. Replacing a
 * file needs a new name: the CDN caches them as immutable.
 */
const FACADE = {
  url: '/assets/views/haussmann4-cut.webp',
  depth: '/assets/views/haussmann4-depth.png',
  width: 14.9,
  bottom: 4.5,
  stone: 0.61,
} as const
/** The relief's front and back (m from the wall), as the height maps encode them. */
const RELIEF_OUT = 0.6
const RELIEF_IN = -0.7
/** The railings' and balconettes' ironwork, out from the wall (m). */
const RAIL_OUT = 0.55
const BALCONETTE_OUT = 0.33
/**
 * The most steps a view ray takes through the relief: at a grazing angle (1.4 cm each); a third of
 * them head-on, where it travels least sideways. Too few left combs on steep edges at a slant.
 */
const RELIEF_STEPS = 96
/**
 * A shaded limestone facade's stone over the sky's radiance: albedo ≈ 0.6 under about half the
 * sky, ρ·E/π ≈ 0.3 (research §2). (With the first photo it shows as before: 0.2 × its mean.)
 */
const STONE_SHADE = 0.3
/** The street in shade: asphalt albedo ≈ 0.15 under half the sky. */
const STREET_SHADE = 0.075
/** The mirrored copies of the photo across the row: one either side. */
const FACADE_COPIES = 3
/** A sky panel this close to a pane is that window's sky (as `brightenWindows` reads it). */
const PANEL_REACH = 3

type Nodes = Record<string, Mesh & { geometry: BufferGeometry }>

const nodeBox = (node: Mesh & { geometry: BufferGeometry }): Box3 => {
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

/**
 * One street per way the panes face, in the order of their first pane: their mean centre and the
 * horizontal way out — toward the pane's sky panel, or away from the room's middle.
 */
const streets = (nodes: Nodes, room: Vector3 | null): { center: Vector3; outward: Vector3 }[] => {
  const facings: { center: Vector3; outward: Vector3; count: number }[] = []
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
        .multiplyScalar(same.count)
        .add(center)
        .divideScalar(same.count + 1)
      same.count++
    } else facings.push({ center, outward, count: 1 })
  }
  return facings
}

/** The photo sampled out of focus (`exteriorBlur`: mip bias), flat. */
const FLAT_MAP = /* glsl */ `#ifdef USE_MAP
	diffuseColor *= texture2D( map, vMapUv, exteriorBlur );
#endif`

/**
 * Parallax occlusion: from the relief's front (the plane, RELIEF_OUT before the wall) the view ray
 * steps into the height map until it passes under the surface, then is refined between the last
 * two steps; the photo is read where it landed. Balconies hide what is behind them and window
 * reveals open as the visitor moves. Gradients from the plane's own uv: no seams at the steps.
 */
const RELIEF_MAP = /* glsl */ `#ifdef USE_MAP
	vec2 facadeUv = vMapUv;
	vec2 facadeDx = dFdx( vMapUv ), facadeDy = dFdy( vMapUv );
	{
		vec3 view = normalize( cameraPosition - vFacadeWorld );
		vec3 tangent = vec3( dot( view, vFacadeT ), dot( view, vFacadeB ), max( dot( view, vFacadeN ), 0.1 ) );
		// The uv the ray travels sideways per metre it goes in.
		vec2 perMeter = - tangent.xy / tangent.z * facadeUvPerMeter;
		int steps = int( mix( float( RELIEF_STEPS ), float( RELIEF_STEPS ) / 3.0, tangent.z ) );
		float stepDepth = RELIEF_RANGE / float( steps );
		float rayDepth = 0.0;
		float surface = ( 1.0 - textureGrad( facadeHeight, facadeUv, facadeDx, facadeDy ).r ) * RELIEF_RANGE;
		vec2 previousUv = facadeUv;
		float previousGap = surface;
		for ( int i = 0; i < RELIEF_STEPS; i ++ ) {
			if ( i >= steps || rayDepth >= surface ) break;
			previousUv = facadeUv;
			previousGap = surface - rayDepth;
			rayDepth += stepDepth;
			facadeUv = vMapUv + perMeter * rayDepth;
			surface = ( 1.0 - textureGrad( facadeHeight, facadeUv, facadeDx, facadeDy ).r ) * RELIEF_RANGE;
		}
		float gap = surface - rayDepth;
		float hitDepth = rayDepth;
		if ( previousGap > 0.0 && gap < 0.0 ) {
			float w = gap / ( gap - previousGap );
			facadeUv = mix( facadeUv, previousUv, w );
			hitDepth = rayDepth - stepDepth * w;
		}
		// The ironwork, in front of what the ray met: where it crosses a bar, the bar.
		float railDepth = RELIEF_OUT - RAIL_OUT;
		vec2 railUv = vMapUv + perMeter * railDepth;
		float balconetteDepth = RELIEF_OUT - BALCONETTE_OUT;
		vec2 balconetteUv = vMapUv + perMeter * balconetteDepth;
		if ( railDepth < hitDepth && textureGrad( facadeHeight, railUv, facadeDx, facadeDy ).g > 0.5 ) facadeUv = railUv;
		else if ( balconetteDepth < hitDepth && textureGrad( facadeHeight, balconetteUv, facadeDx, facadeDy ).b > 0.5 ) facadeUv = balconetteUv;
	}
	float facadeBlur = exp2( exteriorBlur );
	diffuseColor *= textureGrad( map, facadeUv, facadeDx * facadeBlur, facadeDy * facadeBlur );
#endif`

/**
 * Seen through the glass: the photo a little out of focus, the sky's light laid over it — with the
 * facade's relief when it has a height map.
 */
const throughGlass =
  (blur: number, veil: number, veilColor: Color, relief?: { map: Texture; uvPerMeter: Vector2 }) =>
  (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.exteriorBlur = { value: blur }
    shader.uniforms.exteriorVeil = { value: veil }
    shader.uniforms.exteriorVeilColor = { value: veilColor }
    let head = `uniform float exteriorBlur;
uniform float exteriorVeil;
uniform vec3 exteriorVeilColor;
`
    if (relief) {
      shader.uniforms.facadeHeight = { value: relief.map }
      shader.uniforms.facadeUvPerMeter = { value: relief.uvPerMeter }
      head += `#define RELIEF_STEPS ${RELIEF_STEPS}
#define RELIEF_RANGE ${(RELIEF_OUT - RELIEF_IN).toFixed(4)}
#define RELIEF_OUT ${RELIEF_OUT.toFixed(4)}
#define RAIL_OUT ${RAIL_OUT.toFixed(4)}
#define BALCONETTE_OUT ${BALCONETTE_OUT.toFixed(4)}
uniform sampler2D facadeHeight;
uniform vec2 facadeUvPerMeter;
varying vec3 vFacadeWorld;
varying vec3 vFacadeT;
varying vec3 vFacadeB;
varying vec3 vFacadeN;
`
      shader.vertexShader = `varying vec3 vFacadeWorld;
varying vec3 vFacadeT;
varying vec3 vFacadeB;
varying vec3 vFacadeN;
${shader.vertexShader}`.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
	vFacadeWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
	vFacadeT = normalize( mat3( modelMatrix ) * vec3( 1.0, 0.0, 0.0 ) );
	vFacadeB = normalize( mat3( modelMatrix ) * vec3( 0.0, 1.0, 0.0 ) );
	vFacadeN = normalize( mat3( modelMatrix ) * vec3( 0.0, 0.0, 1.0 ) );`,
      )
    }
    shader.fragmentShader = `${head}${shader.fragmentShader}`
      .replace('#include <map_fragment>', relief ? RELIEF_MAP : FLAT_MAP)
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
  /** The facade's relief, or flat. */
  relief: boolean
  center: Vector3
  outward: Vector3
  /** The room's middle (the shell's), or null. */
  room: Vector3 | null
  /** The room's floor (m). */
  floor: number
  /** The sky's radiance in the bake. */
  sky: Color
  /** Once the facade has loaded: the glass may stop drawing. */
  onShown: () => void
}

/** One street: the facade across it, the street below, the sky over the roofs. */
const Street: React.FC<StreetProps> = ({
  relief: withRelief,
  center,
  outward,
  room,
  floor,
  sky,
  onShown,
}) => {
  const { photo, heights } = useResilientTexture({
    photo: assetUrl(FACADE.url),
    heights: assetUrl(FACADE.depth),
  })
  // A map that failed for good comes back as the loader's shared stand-in, never to be changed:
  // without the photo no street (the glass stays as it was), without the heights a flat facade.
  const loaded = !isFallbackTexture(photo)
  const relief = withRelief && !isFallbackTexture(heights) ? heights : null
  const facade = useMemo(() => {
    if (!loaded) return null
    const image = photo.image as { width: number; height: number }
    const height = (FACADE.width * image.height) / image.width
    // From the street up: the photo from its lower edge, its bottom row drawn down to the street.
    const total = FACADE.bottom + height
    photo.colorSpace = SRGBColorSpace
    photo.wrapS = MirroredRepeatWrapping
    // The middle copy as photographed, a mirrored one either side.
    photo.repeat.set(FACADE_COPIES, total / height)
    photo.offset.set(-(FACADE_COPIES - 1) / 2, -FACADE.bottom / height)
    photo.needsUpdate = true
    // The heights are read at the photo's uv, mirrored the same way.
    if (relief) {
      relief.wrapS = MirroredRepeatWrapping
      relief.needsUpdate = true
    }
    return {
      width: FACADE.width * FACADE_COPIES,
      height: total,
      uvPerMeter: new Vector2(1 / FACADE.width, 1 / height),
    }
  }, [loaded, photo, relief])

  // On screen the sky shows about as bright as today's frosted glass (its emissive × 2), shaded
  // from the horizon up (`SKY`).
  const skyLook = useMemo(() => {
    const shown = sky.clone().multiplyScalar(GLASS_ON_SCREEN * 2)
    return skyGradient(
      shown.clone().multiply(new Color(...SKY.horizon)),
      shown.clone().multiply(new Color(...SKY.zenith)),
    )
  }, [sky])
  const facadeColor = useMemo(() => sky.clone().multiplyScalar(STONE_SHADE / FACADE.stone), [sky])
  const streetColor = useMemo(() => sky.clone().multiplyScalar(STREET_SHADE), [sky])
  const glass = useMemo(() => throughGlass(GLASS_BLUR, GLASS_VEIL, sky), [sky])
  const facadeGlass = useMemo(
    () =>
      relief && facade
        ? throughGlass(GLASS_BLUR, GLASS_VEIL, sky, { map: relief, uvPerMeter: facade.uvPerMeter })
        : glass,
    [sky, relief, facade, glass],
  )
  useLayoutEffect(() => {
    if (loaded) onShown()
  }, [loaded, onShown])
  if (!facade) return null

  const yaw = Math.atan2(-outward.x, -outward.z)
  // Seen from inside, the street lies on the far side of the window from the room's middle: the
  // photo's middle copy goes where the line from the room's middle through the window meets the
  // facade — its mirrored seams out of the usual view — yet always 2.5 m or more either side of the
  // window, so a visitor looking straight out never sees one.
  let along = 0
  if (room) {
    const lateral = (center.x - room.x) * Math.cos(yaw) - (center.z - room.z) * Math.sin(yaw)
    const depth = (center.x - room.x) * outward.x + (center.z - room.z) * outward.z
    const reach = Math.max(0, FACADE.width / 2 - 2.5)
    along = depth > 0 ? Math.max(-reach, Math.min(reach, (lateral * FACADE_DISTANCE) / depth)) : 0
  }
  return (
    <group
      // Local −z is out of the window; y 0 is the street.
      position={[center.x, floor - STREET_BELOW, center.z]}
      rotation={[0, yaw, 0]}
    >
      <mesh
        // With relief the plane is its front: the wall stays at the street's width.
        position={[along, facade.height / 2, -FACADE_DISTANCE + (relief ? RELIEF_OUT : 0)]}
      >
        <planeGeometry args={[facade.width, facade.height]} />
        <meshBasicMaterial
          map={photo}
          color={facadeColor}
          // The cut-out sky: ours shows through.
          alphaTest={0.5}
          onBeforeCompile={facadeGlass}
          customProgramCacheKey={() => (relief ? 'exterior-glass-relief' : 'exterior-glass')}
        />
      </mesh>
      <mesh position={[along, 0, -FACADE_DISTANCE / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[facade.width, FACADE_DISTANCE]} />
        <meshBasicMaterial
          color={streetColor}
          onBeforeCompile={glass}
          customProgramCacheKey={() => 'exterior-glass'}
        />
      </mesh>
      <mesh position={[0, 100, -FACADE_DISTANCE - 80]}>
        <planeGeometry args={[600, 300]} />
        <meshBasicMaterial onBeforeCompile={skyLook} customProgramCacheKey={() => 'exterior-sky'} />
      </mesh>
    </group>
  )
}

interface ExteriorViewProps {
  nodes: Nodes
  /** The facade's relief, or flat (`exteriorShown`). */
  relief: boolean
  /** The space's window brightness and daylight gain: the sky's radiance in the bake. */
  windowIntensity: number
  daylightGain: number
  /** Once the facade has loaded: the glass may stop drawing. */
  onShown: () => void
}

const ExteriorView: React.FC<ExteriorViewProps> = ({
  nodes,
  relief,
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
  const room = useMemo(
    () => (nodes.wall0 ? nodeBox(nodes.wall0).getCenter(new Vector3()) : null),
    [nodes],
  )
  const rows = useMemo(() => streets(nodes, room), [nodes, room])

  return (
    <>
      {rows.map(({ center, outward }, i) => (
        <Street
          key={`exterior-${i}`}
          relief={relief}
          center={center}
          outward={outward}
          room={room}
          floor={floor}
          sky={sky}
          onShown={onShown}
        />
      ))}
    </>
  )
}

export default ExteriorView
