import { FrontSide, MeshStandardMaterial, NoColorSpace, Vector3, type Texture } from 'three'

import {
  ARTWORK_FILE_ALPHA,
  ROOM_CAMERA,
} from '@/components/scene/spaces/objects/Display/artworkFile'

import { LIGHTBOX_ALPHA, LIGHTBOX_FEED_MAX, LIGHTBOX_FILM } from './lightboxLook'

/**
 * AR-183 — a lightbox's front: the image IS the light (docs/lightbox §1). No light of the room
 * falls on it; its color is the film × the light's color × its brightness, so blacks stay black
 * (a multiply, never an add). Matte: only that. Glossy: plus the faint reflection of the room a
 * glazed front gives back (the room's captured environment and the lamps' highlights, ~4 %
 * head-on: a black dielectric's specular, `outgoingLight` with no diffuse).
 *
 * Built on MeshStandardMaterial for the glossy front's reflections; its diffuse is black and its
 * `map` is only the image's texture (and the cover crop `vMapUv` carries). The bake's art-bounce
 * patch chains onto these hooks (it touches the indirect diffuse only, which is black here).
 *
 * Baked look: the image is shown past the camera, like every artwork file (`artworkFile.ts`): it
 * writes what the screen shows, rolled off before white (`lightboxShoulder`), and the reflection
 * as the camera shows it. Bloom sees that × the feed; the alpha carries the feed
 * (`LIGHTBOX_ALPHA`) and `ArtworkFileEffect` divides it back out. The outermost pixels (the
 * antialiased edge, the light leak) write the plain artwork marker, feed 1, so an edge pixel
 * shared with the box blends exactly as any artwork's.
 *
 * Today's look: the front in the room's units; the screen's tone mapping and bloom do the rest.
 */

export type LightboxUniforms = {
  lbTint: { value: Vector3 }
  lbGain: { value: number }
  lbFeed: { value: number }
}

type LightboxShaderOptions = { glossy: boolean; baked: boolean; decode: boolean }

const FILM = LIGHTBOX_FILM

const LIGHTBOX_PARS = /* glsl */ `
uniform vec3 lbTint;
uniform float lbGain;
uniform float lbFeed;
uniform float roomExposure;
uniform vec3 roomWhiteBalance;
varying vec2 vLbUv;

// Pixels from the image's nearest edge (screen space: the band is as thin up close as far away).
float lightboxEdgePx( vec2 uv ) {
	vec2 d = min( uv, 1.0 - uv ) / max( fwidth( uv ), vec2( 1e-6 ) );
	return min( d.x, d.y );
}

// The film's character: saturation and contrast lifted, a soft fall-off to the corners, a thin
// bright line where it meets the box.
vec3 lightboxFilm( vec3 c, vec2 uv, float edgePx ) {
	float luma = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
	c = max( vec3( 0.0 ), vec3( luma ) + ( c - vec3( luma ) ) * ${FILM.saturation.toFixed(3)} );
	c = 0.18 * pow( c / 0.18, vec3( ${FILM.contrast.toFixed(3)} ) );
	vec2 p = ( uv - 0.5 ) * 2.0;
	c *= 1.0 - ${FILM.falloff.toFixed(3)} * 0.5 * dot( p, p );
	float leak = 1.0 - smoothstep( 0.0, ${FILM.leakPx.toFixed(2)}, edgePx );
	return mix( c, vec3( 1.0 ), ${FILM.leak.toFixed(3)} * leak );
}

// What the screen can show of it: unchanged up to 0.9, then rolled off towards white (Khronos PBR
// Neutral's highlight compression, started later): whites stay white, never clip.
vec3 lightboxShoulder( vec3 color ) {
	const float start = 0.9;
	const float desaturation = 0.15;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < start ) return color;
	float d = 1.0 - start;
	float newPeak = 1.0 - d * d / ( peak + d - start );
	color *= newPeak / peak;
	float g = 1.0 - 1.0 / ( desaturation * ( peak - newPeak ) + 1.0 );
	return mix( color, vec3( newPeak ), g );
}
`

const LIGHTBOX_MAP = (decode: boolean) => /* glsl */ `
vec4 lbTexel = texture2D( map, vMapUv );
${decode ? 'lbTexel = sRGBTransferEOTF( lbTexel );' : ''}
`

const LIGHTBOX_OUT = ({ glossy, baked }: LightboxShaderOptions) => /* glsl */ `
#include <opaque_fragment>
float lbEdgePx = lightboxEdgePx( vLbUv );
vec3 lbLight = lightboxFilm( lbTexel.rgb, vLbUv, lbEdgePx ) * lbTint * lbGain;
vec3 lbReflect = ${glossy ? 'outgoingLight' : 'vec3( 0.0 )'};
${
  baked
    ? `vec3 lbShown = lightboxShoulder( lbLight ) + lbReflect * roomExposure * roomWhiteBalance;
if ( lbEdgePx < 2.5 || lbFeed <= 1.0 ) {
	gl_FragColor = vec4( lbShown, ${ARTWORK_FILE_ALPHA.toFixed(2)} );
} else {
	gl_FragColor = vec4( lbShown * lbFeed, ${LIGHTBOX_ALPHA.min.toFixed(2)} + ${(LIGHTBOX_ALPHA.max - LIGHTBOX_ALPHA.min).toFixed(2)} * lbFeed / ${LIGHTBOX_FEED_MAX.toFixed(1)} );
}`
    : 'gl_FragColor = vec4( lbLight + lbReflect, 1.0 );'
}
`

/** A lightbox front's material for one image; `setLightbox` keeps its light current. */
export const createLightboxMaterial = (
  map: Texture,
  options: LightboxShaderOptions,
): MeshStandardMaterial & { userData: { lightbox: LightboxUniforms } } => {
  const uniforms: LightboxUniforms = {
    lbTint: { value: new Vector3(1, 1, 1) },
    lbGain: { value: 1 },
    lbFeed: { value: 1 },
  }
  const material = new MeshStandardMaterial({
    map,
    color: 0x000000,
    metalness: 0,
    roughness: options.glossy ? 0.06 : 1,
    envMapIntensity: options.glossy ? 1 : 0,
    side: FrontSide,
  })
  material.userData.lightbox = uniforms
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, {
      roomExposure: ROOM_CAMERA.exposure,
      roomWhiteBalance: ROOM_CAMERA.whiteBalance,
    })
    shader.vertexShader = `varying vec2 vLbUv;\n${shader.vertexShader}`.replace(
      '#include <uv_vertex>',
      '#include <uv_vertex>\n\tvLbUv = uv;',
    )
    shader.fragmentShader = `${LIGHTBOX_PARS}\n${shader.fragmentShader}`
      .replace('#include <map_fragment>', LIGHTBOX_MAP(options.decode))
      .replace('#include <opaque_fragment>', LIGHTBOX_OUT(options))
  }
  material.customProgramCacheKey = () =>
    `lightbox-${options.glossy ? 'glossy' : 'matte'}-${options.baked ? 'baked' : 'today'}${options.decode ? '-encoded' : ''}`
  return material as MeshStandardMaterial & { userData: { lightbox: LightboxUniforms } }
}

/** Whether `map` is an artwork's undecoded twin (`encodedMap`): the shader decodes it. */
export const isEncodedMap = (map: Texture): boolean => map.colorSpace === NoColorSpace
