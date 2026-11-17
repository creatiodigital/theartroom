import {
  FrontSide,
  MeshStandardMaterial,
  NoColorSpace,
  Vector2,
  Vector3,
  type Texture,
} from 'three'

import {
  ARTWORK_FILE_ALPHA,
  ROOM_CAMERA,
} from '@/components/scene/spaces/objects/Display/artworkFile'

import { LIGHTBOX_ALPHA, LIGHTBOX_FEED_MAX, LIGHTBOX_FILM, LIGHTBOX_GLOSS } from './lightboxLook'

/**
 * AR-183 — a lightbox's front: the image IS the light (docs/lightbox §1). No light of the room
 * falls on it — no lamp lights it or glints on it (tuning round 2: "lightboxes are not spot-lit");
 * its color is the film in the light's color, so blacks stay black (a multiply, never an add).
 * Matte: only that. Glossy: plus an acrylic face's soft sheen — the room's captured environment
 * only, blurred (`LIGHTBOX_GLOSS`), never the lamps' highlights (`reflectedLight.indirectSpecular`,
 * not `outgoingLight`: those were sharp white dots over the picture).
 *
 * Built on MeshStandardMaterial for the glossy front's reflections; its diffuse is black and its
 * `map` is only the image's texture (and the cover crop `vMapUv` carries). The bake's art-bounce
 * patch chains onto these hooks (it touches the indirect diffuse only, which is black here).
 *
 * Baked look: the image is shown past the camera, like every artwork file (`artworkFile.ts`): it
 * writes what the screen shows — the film, lifted by its gain and rolled off before white
 * (`lightboxShoulder`) — and the reflection as the camera shows it. Bloom sees that × the feed (a
 * faint rim at the box's edge, `lightboxBloomFeed`); the alpha carries the feed
 * (`lightboxFeedAlpha`) and `ArtworkFileEffect` divides it back out. The outermost pixels (the
 * antialiased edge) write the plain artwork marker, feed 1, so an edge pixel shared with the box
 * blends exactly as any artwork's.
 *
 * Today's look: the front in the room's units (`TODAY_LOOK_FRONT`); the screen's tone mapping and
 * bloom do the rest.
 */

export type LightboxUniforms = {
  lbTint: { value: Vector3 }
  lbGain: { value: number }
  /** The film's saturation and its mid-tone curve's power (`lightboxFilm`). */
  lbFilm: { value: Vector2 }
  lbFeed: { value: number }
}

type LightboxShaderOptions = { glossy: boolean; baked: boolean; decode: boolean }

const FILM = LIGHTBOX_FILM
const glslFloat = (v: number) => v.toFixed(6)

const LIGHTBOX_PARS = /* glsl */ `
uniform vec3 lbTint;
uniform float lbGain;
uniform vec2 lbFilm;
uniform float lbFeed;
uniform float roomExposure;
uniform vec3 roomWhiteBalance;
varying vec2 vLbUv;
varying vec2 vLbPos;
varying vec2 vLbHalf;

// Pixels from the image's nearest edge (screen space: the band is as thin up close as far away).
float lightboxEdgePx( vec2 uv ) {
	vec2 d = min( uv, 1.0 - uv ) / max( fwidth( uv ), vec2( 1e-6 ) );
	return min( d.x, d.y );
}

// The share of this pixel's film that lies in the light leak: the band within ${FILM.leakM * 1000} mm of the
// film's edge, measured in meters (the film's own size), each axis's footprint from fwidth.
float lightboxLeakAxis( float pos, float halfSize ) {
	float d = halfSize - abs( pos );
	float w = max( fwidth( pos ), 1e-7 );
	float lo = max( d - 0.5 * w, 0.0 );
	float film = d + 0.5 * w - lo;
	return clamp( ( min( d + 0.5 * w, ${glslFloat(FILM.leakM)} ) - lo ) / max( film, 1e-7 ), 0.0, 1.0 );
}

// The film's character: more vivid than a print — saturation up, the mid-tones lifted by a power
// that keeps black at black and white at white — a soft fall-off to the corners, a bright line
// where it meets the box.
vec3 lightboxFilm( vec3 c, vec2 uv ) {
	float luma = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
	c = max( vec3( 0.0 ), vec3( luma ) + ( c - vec3( luma ) ) * lbFilm.x );
	c = pow( c, vec3( lbFilm.y ) );
	vec2 p = ( uv - 0.5 ) * 2.0;
	c *= 1.0 - ${FILM.falloff.toFixed(3)} * 0.5 * dot( p, p );
	float leak = max( lightboxLeakAxis( vLbPos.x, vLbHalf.x ), lightboxLeakAxis( vLbPos.y, vLbHalf.y ) );
	return mix( c, vec3( 1.0 ), ${FILM.leak.toFixed(3)} * leak );
}

// What the screen can show of it: unchanged up to 0.9, then rolled off towards white (Khronos PBR
// Neutral's highlight compression, started later): whites stay white, never clip, and a little
// of a bright color's hue goes (0.15): near-whites keep their texture (0.8 burned them out).
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
vec3 lbLight = lightboxFilm( lbTexel.rgb, vLbUv ) * lbTint * lbGain;
vec3 lbReflect = ${glossy ? 'reflectedLight.indirectSpecular' : 'vec3( 0.0 )'};
${
  baked
    ? `vec3 lbShown = lightboxShoulder( lbLight ) + lbReflect * roomExposure * roomWhiteBalance;
if ( lightboxEdgePx( vLbUv ) < 2.5 || lbFeed <= 1.0 ) {
	gl_FragColor = vec4( lbShown, ${ARTWORK_FILE_ALPHA.toFixed(2)} );
} else {
	gl_FragColor = vec4( lbShown * lbFeed, ${glslFloat(LIGHTBOX_ALPHA.min)} + ${glslFloat((LIGHTBOX_ALPHA.max - LIGHTBOX_ALPHA.min) / Math.log2(LIGHTBOX_FEED_MAX))} * log2( lbFeed ) );
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
    lbFilm: { value: new Vector2(1, 1) },
    lbFeed: { value: 1 },
  }
  const material = new MeshStandardMaterial({
    map,
    color: 0x000000,
    metalness: 0,
    roughness: options.glossy ? LIGHTBOX_GLOSS.roughness : 1,
    envMapIntensity: options.glossy ? LIGHTBOX_GLOSS.reflect : 0,
    side: FrontSide,
  })
  material.userData.lightbox = uniforms
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, {
      roomExposure: ROOM_CAMERA.exposure,
      roomWhiteBalance: ROOM_CAMERA.whiteBalance,
    })
    // The image's plane is one quad: every vertex is a corner, so |position| is its half size.
    shader.vertexShader =
      `varying vec2 vLbUv;\nvarying vec2 vLbPos;\nvarying vec2 vLbHalf;\n${shader.vertexShader}`.replace(
        '#include <uv_vertex>',
        '#include <uv_vertex>\n\tvLbUv = uv;\n\tvLbPos = position.xy;\n\tvLbHalf = abs( position.xy );',
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
