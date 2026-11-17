import { useContext, useLayoutEffect, useMemo, useState } from 'react'
import { useThree } from '@react-three/fiber'
import {
  AddEquation,
  BufferGeometry,
  Color,
  CustomBlending,
  DoubleSide,
  DstColorFactor,
  ExtrudeGeometry,
  Float32BufferAttribute,
  MeshStandardMaterial,
  OneFactor,
  Shape,
  Vector2,
  ZeroFactor,
  type Texture,
} from 'three'

import { useBakedLook } from '@/components/scene/bake/bakedLook'
import {
  BLOOM_THRESHOLD,
  lampGlowScale,
} from '@/components/scene/spaces/objects/Effects/bloomIntensity'
import { Frame } from '@/components/scene/spaces/objects/Frame'
import { WOOD_TILE_M } from '@/components/scene/spaces/objects/Frame/Frame'
import { useDisposable } from '@/components/scene/spaces/objects/useDisposable'
import type { TLightbox, TLightboxMaterial } from '@/lib/lightbox'

import { LightboxImageMeanContext, imageMeanColor, meanHue, type Rgb } from './imageMean'
import {
  LIGHTBOX_FEED_MAX,
  LIGHTBOX_REFLECT,
  LIGHTBOX_RIM_SIDES,
  LIGHTBOX_SPILL,
  LIGHTBOX_TINT,
  LIGHTBOX_WASH,
  LIT_WALL,
  TODAY_LOOK_FRONT,
  lightboxBloomFeed,
  lightboxBox,
  lightboxFilm,
  lightboxGain,
  lightboxImageTint,
  lightboxPanel,
} from './lightboxLook'
import { createLightboxMaterial, isEncodedMap } from './lightboxMaterial'

/** The frame's wood maps (`Display` loads them: oak is its light wood, walnut its dark). */
export type WoodMaps = { diffuse: Texture; normal: Texture; roughnessMap: Texture }

/** Oak and walnut are the frame's woods, so wood looks the same on a frame and a lightbox. */
export const LIGHTBOX_WOOD: Partial<Record<TLightboxMaterial, string>> = {
  oak: 'wood-light',
  walnut: 'wood-dark',
}

const boxMaterial = (kind: TLightboxMaterial, wood: WoodMaps | null): MeshStandardMaterial => {
  switch (kind) {
    // Powder-coated / anodized black: a dark dielectric with a soft sheen.
    case 'alu-black':
      return new MeshStandardMaterial({ color: '#151515', roughness: 0.45, metalness: 0 })
    // Brushed aluminum: a metal (its color is its reflectance).
    case 'alu-silver':
      return new MeshStandardMaterial({ color: '#cfd2d4', roughness: 0.35, metalness: 1 })
    case 'white':
      return new MeshStandardMaterial({ color: '#f1f0ec', roughness: 0.6, metalness: 0 })
    // The frame's natural wood, as `Display` draws it unpainted.
    default:
      return new MeshStandardMaterial({
        map: wood?.diffuse ?? null,
        normalMap: wood?.normal ?? null,
        normalScale: new Vector2(0.5, 0.5),
        roughnessMap: wood?.roughnessMap ?? null,
        color: wood ? '#ffffff' : kind === 'oak' ? '#b48d62' : '#5a3b27',
        roughness: 0.6,
        metalness: 0.05,
      })
  }
}

/** Edge to edge: the box itself under the film, its UVs in tiles of real board (`WOOD_TILE_M`). */
const CoreBox = ({
  width,
  height,
  depth,
  material,
}: {
  width: number
  height: number
  depth: number
  material: MeshStandardMaterial
}) => {
  const geometry = useMemo(() => {
    const shape = new Shape()
    shape.moveTo(-width / 2, -height / 2)
    shape.lineTo(width / 2, -height / 2)
    shape.lineTo(width / 2, height / 2)
    shape.lineTo(-width / 2, height / 2)
    shape.closePath()
    const geo = new ExtrudeGeometry(shape, { steps: 1, depth, bevelEnabled: false })
    const uv = geo.getAttribute('uv')
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, uv.getX(i) / WOOD_TILE_M, uv.getY(i) / WOOD_TILE_M)
    uv.needsUpdate = true
    return geo
  }, [width, height, depth])
  useDisposable(geometry)
  return <mesh geometry={geometry} material={material} castShadow receiveShadow />
}

type LightboxBoxProps = {
  /** The image's size (m). */
  width: number
  height: number
  lightbox: TLightbox
  wood: WoodMaps | null
}

/**
 * The box behind and around the image (docs/lightbox §3): its depth from the wall, the edge as a
 * front border (mitered bars, as a frame: wood runs along each), or, edge to edge, the box alone
 * under the film. The film is in front of it (`Display`).
 */
export function LightboxBox({ width, height, lightbox, wood }: LightboxBoxProps) {
  const { edge, depth } = lightboxBox(lightbox)
  const material = useMemo(
    () => boxMaterial(lightbox.lightboxMaterial, wood),
    [lightbox.lightboxMaterial, wood],
  )
  useDisposable(material)

  if (edge > 0)
    return (
      <Frame
        width={width + edge * 2}
        height={height + edge * 2}
        thickness={edge}
        depth={depth}
        material={material}
        cornerStyle="mitered"
      />
    )
  return <CoreBox width={width} height={height} depth={depth} material={material} />
}

/**
 * The front's material on the image mesh (`lightboxMaterial.ts`). Rebuilt only when its shader
 * changes (front, look, the texture's encoding); brightness and color are uniforms, so the slider
 * shows at once.
 */
export function LightboxSurface({ map, lightbox }: { map: Texture; lightbox: TLightbox }) {
  const baked = useBakedLook().baked
  const glossy = lightbox.lightboxFront === 'glossy'
  const decode = isEncodedMap(map)
  return (
    <LightboxSurfaceMaterial
      key={`${glossy}-${baked}-${decode}`}
      map={map}
      lightbox={lightbox}
      options={{ glossy, baked, decode }}
    />
  )
}

const LightboxSurfaceMaterial = ({
  map,
  lightbox,
  options,
}: {
  map: Texture
  lightbox: TLightbox
  options: { glossy: boolean; baked: boolean; decode: boolean }
}) => {
  const [material] = useState(() => createLightboxMaterial(map, options))
  useDisposable(material)
  // A device that can't keep light over white in the screen's buffer shows the picture, no glow.
  const gl = useThree((s) => s.gl)
  const hdr = useMemo(
    () =>
      gl.extensions.has('EXT_color_buffer_float') ||
      gl.extensions.has('EXT_color_buffer_half_float'),
    [gl],
  )

  // The image's average color, once its texture has loaded: the wash and the spill take its hue.
  const reportMean = useContext(LightboxImageMeanContext)
  useLayoutEffect(() => {
    material.map = map
    reportMean(imageMeanColor(map.image))
  }, [material, map, reportMean])

  const { lightboxBrightness: brightness, lightboxLight: light } = lightbox
  useLayoutEffect(() => {
    const uniforms = material.userData.lightbox
    // The light's color, lightly, on the picture; in full on what its light falls on.
    uniforms.lbTint.value.set(...lightboxImageTint(light))
    // The bake's emitter reads the panel's light, in the light's own color (`lightboxEmitters`).
    material.userData.lightboxPanel = lightboxPanel(brightness)
    material.userData.lightboxColor = LIGHTBOX_TINT[light]
    // The baked look lifts the mid-tones (`lightboxFilm`), never scales the picture: on screen a
    // print's whites are already the screen's.
    uniforms.lbGain.value = options.baked ? 1 : lightboxGain(brightness) * TODAY_LOOK_FRONT
    const film = lightboxFilm(brightness)
    uniforms.lbFilm.value.set(film.saturation, film.power)
    uniforms.lbFeed.value =
      options.baked && hdr
        ? Math.min(
            LIGHTBOX_FEED_MAX,
            lightboxBloomFeed(brightness, BLOOM_THRESHOLD * lampGlowScale(true)),
          )
        : 1
  }, [material, brightness, light, options.baked, hdr])

  return <primitive object={material} attach="material" />
}

const WASH_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
	vUv = uv;
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`

/**
 * The light on the wall round the box (`LIGHTBOX_WASH`): alike on all four sides, falling off as a
 * light's glow does — steeply near the box, a long soft tail — and faded to nothing at `uReach`
 * (no edge: a smoothstep's plateau read as a plate on a dim wall).
 */
const WASH_FRAGMENT = /* glsl */ `
uniform vec2 uBox;
uniform vec2 uPlane;
uniform vec3 uColor;
uniform float uReach;
varying vec2 vUv;
void main() {
	vec2 pos = ( vUv - 0.5 ) * uPlane;
	vec2 d = abs( pos ) - uBox * 0.5;
	if ( d.x < 0.0 && d.y < 0.0 ) discard;
	float dist = length( max( d, 0.0 ) ) / uReach;
	float glow = exp( -1.5 * dist ) * ( 1.0 - smoothstep( 0.6, 1.0, dist ) );
	gl_FragColor = vec4( uColor * glow, 0.0 );
}
`

type LightboxWashProps = {
  /** The box's outer size (m). */
  width: number
  height: number
  lightbox: TLightbox
  /** The image's average color (`imageMeanColor`; null until read: white). */
  mean: Rgb | null
}

/**
 * The light on the wall round the box (docs/lightbox §5, tuning rounds 1–2: `LIGHTBOX_WASH`): the
 * wall there that much lighter, in the image's hue × the light's color — a multiply of what the
 * wall shows, so a dark wall and a white one both read +14 % at Bright. Light only (the alpha under it, the wall's,
 * is kept); never a real-time light. On a plane over the box and the wall around it, the box's
 * own area left out.
 */
export function LightboxWash({ width, height, lightbox, mean }: LightboxWashProps) {
  const reach = LIGHTBOX_WASH.reach(lightbox.lightboxBrightness, width, height)
  const plane: [number, number] = [width + reach * 2, height + reach * 2]
  const [uniforms] = useState(() => ({
    uBox: { value: new Vector2() },
    uPlane: { value: new Vector2() },
    uColor: { value: new Color() },
    uReach: { value: 0 },
  }))
  const { lightboxBrightness: brightness, lightboxLight: light } = lightbox
  useLayoutEffect(() => {
    uniforms.uBox.value.set(width, height)
    uniforms.uPlane.value.set(width + reach * 2, height + reach * 2)
    uniforms.uReach.value = reach
    uniforms.uColor.value
      .setRGB(...LIGHTBOX_TINT[light])
      .multiply(new Color().setRGB(...meanHue(mean, LIGHTBOX_WASH.colorShare)))
      .multiplyScalar(LIGHTBOX_WASH.atEdge(brightness))
  }, [uniforms, width, height, reach, brightness, light, mean])

  return (
    <mesh position={[0, 0, 0.0015]} renderOrder={0}>
      <planeGeometry args={plane} />
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={CustomBlending}
        blendEquation={AddEquation}
        blendSrc={DstColorFactor}
        blendDst={OneFactor}
        blendSrcAlpha={ZeroFactor}
        blendDstAlpha={OneFactor}
        uniforms={uniforms}
        vertexShader={WASH_VERTEX}
        fragmentShader={WASH_FRAGMENT}
      />
    </mesh>
  )
}

const SIDES_VERTEX = /* glsl */ `
attribute float lipward;
varying float vLipward;
void main() {
	vLipward = lipward;
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`

const SIDES_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
varying float vLipward;
void main() {
	gl_FragColor = vec4( uColor * ( 1.0 - 0.3 * vLipward ), 1.0 );
}
`

/**
 * The rebate's four sides, from the film (`z0`) to the box's front (`z1`), just inside the edge's
 * bars; `lipward` runs 0 at the film to 1 at the front.
 */
const rebateGeometry = (width: number, height: number, z0: number, z1: number) => {
  const x = width / 2 - 0.0001
  const y = height / 2 - 0.0001
  const corners: [number, number][] = [
    [-x, y],
    [x, y],
    [x, -y],
    [-x, -y],
  ]
  const position: number[] = []
  const lipward: number[] = []
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = corners[i]!
    const [bx, by] = corners[(i + 1) % 4]!
    position.push(ax, ay, z0, bx, by, z0, bx, by, z1, ax, ay, z0, bx, by, z1, ax, ay, z1)
    lipward.push(0, 0, 1, 0, 1, 1)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3))
  geometry.setAttribute('lipward', new Float32BufferAttribute(lipward, 1))
  return geometry
}

type LightboxRimProps = {
  /** The image's size (m). */
  width: number
  height: number
  /** Where the film sits (m from the wall). */
  filmZ: number
  lightbox: TLightbox
  /** The image's average color (`imageMeanColor`; null until read: white). */
  mean: Rgb | null
}

/**
 * The spill (`LIGHTBOX_SPILL`): light added on the edge's front, from the image's border outwards,
 * fading out over `uReach`; the image itself (inside `uInner`) is left as it is.
 */
const SPILL_FRAGMENT = /* glsl */ `
uniform vec2 uInner;
uniform vec2 uPlane;
uniform vec3 uColor;
uniform float uReach;
varying vec2 vUv;
void main() {
	vec2 pos = ( vUv - 0.5 ) * uPlane;
	vec2 d = abs( pos ) - uInner * 0.5;
	if ( d.x < 0.0 && d.y < 0.0 ) discard;
	float glow = 1.0 - smoothstep( 0.0, uReach, length( max( d, 0.0 ) ) );
	gl_FragColor = vec4( uColor * glow * glow, 0.0 );
}
`

/**
 * The box catching its own light (tuning rounds 1–2, docs/lightbox): the rebate's sides around the
 * film glow in the light's color — × the panel's light and what the box's material gives back
 * (`LIGHTBOX_REFLECT`, `LIGHTBOX_RIM_SIDES`), in the room's units: past the camera's exposure as any
 * surface (faint on black, bright on white and silver) — and the image's light spills over the
 * edge's inner lip (`LIGHTBOX_SPILL`), in the image's hue × the light's color, whatever the edge is
 * made of. Edge to edge there is no rebate and no lip.
 */
export function LightboxRim({ width, height, filmZ, lightbox, mean }: LightboxRimProps) {
  const baked = useBakedLook().baked
  const { edge, depth } = lightboxBox(lightbox)
  const panel = baked
    ? lightboxPanel(lightbox.lightboxBrightness)
    : lightboxGain(lightbox.lightboxBrightness) * TODAY_LOOK_FRONT
  const light = new Color()
    .setRGB(...LIGHTBOX_TINT[lightbox.lightboxLight])
    .multiply(new Color().setRGB(...LIGHTBOX_REFLECT[lightbox.lightboxMaterial]))
    .multiplyScalar(panel)
  const [sides] = useState(() => ({ uColor: { value: new Color() } }))
  const spillReach = Math.min(edge, LIGHTBOX_SPILL.reachM(lightbox.lightboxBrightness))
  const spillPlane: [number, number] = [width + spillReach * 2, height + spillReach * 2]
  const [spill] = useState(() => ({
    uInner: { value: new Vector2() },
    uPlane: { value: new Vector2() },
    uColor: { value: new Color() },
    uReach: { value: 0 },
  }))
  useLayoutEffect(() => {
    sides.uColor.value.copy(light).multiplyScalar(LIGHTBOX_RIM_SIDES)
    spill.uInner.value.set(width, height)
    spill.uPlane.value.set(...spillPlane)
    spill.uReach.value = spillReach
    spill.uColor.value
      .setRGB(...LIGHTBOX_TINT[lightbox.lightboxLight])
      .multiply(new Color().setRGB(...meanHue(mean, 1)))
      .multiplyScalar(LIT_WALL * LIGHTBOX_SPILL.atEdge(lightbox.lightboxBrightness))
  })
  const geometry = useMemo(
    () => (edge > 0 && depth > filmZ ? rebateGeometry(width, height, filmZ, depth) : null),
    [edge, width, height, filmZ, depth],
  )
  useDisposable(geometry)
  if (!geometry) return null

  return (
    <>
      <mesh geometry={geometry}>
        <shaderMaterial
          side={DoubleSide}
          uniforms={sides}
          vertexShader={SIDES_VERTEX}
          fragmentShader={SIDES_FRAGMENT}
        />
      </mesh>
      {spillReach > 0 && (
        <mesh position={[0, 0, depth + 0.0003]}>
          <planeGeometry args={spillPlane} />
          <shaderMaterial
            transparent
            depthWrite={false}
            blending={CustomBlending}
            blendEquation={AddEquation}
            blendSrc={OneFactor}
            blendDst={OneFactor}
            blendSrcAlpha={ZeroFactor}
            blendDstAlpha={OneFactor}
            uniforms={spill}
            vertexShader={WASH_VERTEX}
            fragmentShader={SPILL_FRAGMENT}
          />
        </mesh>
      )}
    </>
  )
}
