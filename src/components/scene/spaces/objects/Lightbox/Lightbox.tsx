import { useLayoutEffect, useMemo, useState } from 'react'
import { useThree } from '@react-three/fiber'
import {
  AddEquation,
  Color,
  CustomBlending,
  ExtrudeGeometry,
  MeshStandardMaterial,
  OneFactor,
  Shape,
  Vector2,
  ZeroFactor,
  type Texture,
} from 'three'

import { useBakedLook } from '@/components/scene/bake/bakedLook'
import { ROOM_CAMERA } from '@/components/scene/spaces/objects/Display/artworkFile'
import {
  BLOOM_THRESHOLD,
  lampGlowScale,
} from '@/components/scene/spaces/objects/Effects/bloomIntensity'
import { Frame } from '@/components/scene/spaces/objects/Frame'
import { WOOD_TILE_M } from '@/components/scene/spaces/objects/Frame/Frame'
import { useDisposable } from '@/components/scene/spaces/objects/useDisposable'
import type { TLightbox, TLightboxMaterial } from '@/lib/lightbox'

import {
  LIGHTBOX_FEED_MAX,
  LIGHTBOX_GLOW,
  LIGHTBOX_TINT,
  TODAY_LOOK_FRONT,
  lightboxBloomFeed,
  lightboxBox,
  lightboxGain,
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

  useLayoutEffect(() => {
    material.map = map
  }, [material, map])

  const { lightboxBrightness: brightness, lightboxLight: light } = lightbox
  useLayoutEffect(() => {
    const uniforms = material.userData.lightbox
    uniforms.lbTint.value.set(...LIGHTBOX_TINT[light])
    const gain = lightboxGain(brightness)
    uniforms.lbGain.value = options.baked ? gain : gain * TODAY_LOOK_FRONT
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

const GLOW_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
	vUv = uv;
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`

const GLOW_FRAGMENT = /* glsl */ `
uniform vec2 uInner;
uniform vec2 uOuter;
uniform vec3 uColor;
uniform float uReach;
uniform float uScale;
varying vec2 vUv;
void main() {
	vec2 pos = ( vUv - 0.5 ) * uOuter;
	vec2 d = abs( pos ) - uInner * 0.5;
	if ( d.x < 0.0 && d.y < 0.0 ) discard;
	float dist = length( max( d, 0.0 ) );
	float glow = 1.0 - smoothstep( 0.0, uReach, dist );
	gl_FragColor = vec4( uColor * uScale * glow * glow, 0.0 );
}
`

type LightboxGlowProps = {
  /** The box's outer size (m). */
  width: number
  height: number
  lightbox: TLightbox
}

/**
 * The fallback wash on the wall around the box (docs/lightbox §5): a soft additive glow, tinted
 * and scaled by the brightness. Added light only (the alpha under it, the artwork marker or the
 * wall's, is kept); never a real-time light.
 */
export function LightboxGlow({ width, height, lightbox }: LightboxGlowProps) {
  const baked = useBakedLook().baked
  const reach = LIGHTBOX_GLOW.reach(width, height)
  const outerW = width + reach * 2
  const outerH = height + reach * 2
  const [uniforms] = useState(() => ({
    uInner: { value: new Vector2() },
    uOuter: { value: new Vector2() },
    uColor: { value: new Color() },
    uReach: { value: 0 },
    // The front's white in the room's units: past the camera in the baked look (÷ its exposure),
    // as drawn in today's.
    uScale: { value: 1 },
  }))

  useLayoutEffect(() => {
    uniforms.uInner.value.set(width, height)
    uniforms.uOuter.value.set(outerW, outerH)
    uniforms.uReach.value = reach
    const gain = lightboxGain(lightbox.lightboxBrightness)
    uniforms.uColor.value
      .setRGB(...LIGHTBOX_TINT[lightbox.lightboxLight])
      .multiplyScalar(LIGHTBOX_GLOW.atEdge * gain)
    uniforms.uScale.value = baked
      ? 1 / Math.max(ROOM_CAMERA.exposure.value, 0.05)
      : TODAY_LOOK_FRONT
  }, [uniforms, width, height, outerW, outerH, reach, lightbox, baked])

  return (
    <mesh position={[0, 0, 0.0015]} renderOrder={0}>
      <planeGeometry args={[outerW, outerH]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={CustomBlending}
        blendEquation={AddEquation}
        blendSrc={OneFactor}
        blendDst={OneFactor}
        blendSrcAlpha={ZeroFactor}
        blendDstAlpha={OneFactor}
        uniforms={uniforms}
        vertexShader={GLOW_VERTEX}
        fragmentShader={GLOW_FRAGMENT}
      />
    </mesh>
  )
}
