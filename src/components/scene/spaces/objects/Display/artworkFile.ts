import {
  AddEquation,
  CustomBlending,
  DoubleSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NoColorSpace,
  OneFactor,
  OneMinusSrcAlphaFactor,
  SrcAlphaFactor,
  Vector3,
  ZeroFactor,
  type ColorRepresentation,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from 'three'

/**
 * ⚠️ AR-161 (spec rule 1, the sine qua non) — in the baked look an artwork IMAGE shows exactly its
 * file: no light, exposure, white balance, tone curve, tint or glow on it, even where it then
 * doesn't match the room's light. The image writes its texel (the file's linear color) with alpha
 * ARTWORK_FILE_ALPHA as a marker; the last screen effect (`ArtworkFileEffect`) puts that color back
 * over whatever bloom, white balance, exposure and tone mapping made of it. The passepartout's
 * front face and the paper border count as part of the image (AR-163, Eduardo 2026-10-21: "we need
 * to be able to show a perfectly white passepartout as well as an unaltered picture") and show
 * their own color the same way (`createArtworkSurfaceMaterial`). Frame, card, the passepartout's
 * bevel and edges (AR-165: flat, it had no thickness) and the room stay physically lit.
 */

/** The alpha an artwork image writes (opaque surfaces write 1; nothing else in the room writes this). */
export const ARTWORK_FILE_ALPHA = 0.5

/**
 * The black-and-white fix (Eduardo 2026-10-19, "include it"): artwork maps are sampled UNDECODED,
 * so the GPU's filtering and mipmaps average the file's encoded values, as Photoshop and every
 * browser do; the image shader decodes after. Decoded first (an sRGB texture), fine B&W grain is
 * averaged in linear light and reads 4–5 levels brighter from a distance (exact up close).
 * `false`: the GPU decodes the maps, as everywhere else.
 */
export const ARTWORK_ENCODED_SAMPLING = true

/** The image's texel, decoded from the file's sRGB values after filtering. */
const DECODED_MAP_FRAGMENT = /* glsl */ `
#ifdef USE_MAP
	diffuseColor *= sRGBTransferEOTF( texture2D( map, vMapUv ) );
#endif
`

/**
 * The material of an artwork image in the baked look: unlit, it writes the file's color with the
 * marker. `encodedMap` below gives it the undecoded map when ARTWORK_ENCODED_SAMPLING is on.
 */
export const createArtworkFileMaterial = (map: Texture): MeshBasicMaterial => {
  const material = new MeshBasicMaterial({ map, side: DoubleSide })
  material.onBeforeCompile = (shader) => {
    if (ARTWORK_ENCODED_SAMPLING)
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        DECODED_MAP_FRAGMENT,
      )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `#include <opaque_fragment>\n\tgl_FragColor = vec4( diffuseColor.rgb / max( diffuse, vec3( 1e-4 ) ), ${ARTWORK_FILE_ALPHA.toFixed(2)} );`,
    )
  }
  material.customProgramCacheKey = () =>
    ARTWORK_ENCODED_SAMPLING ? 'artwork-file-encoded' : 'artwork-file'
  return material
}

/**
 * The room's camera as the screen effects apply it — exposure and white balance (`Effects` keeps it
 * current) — for a surface that shows a share of what the room's light makes of it.
 */
export const ROOM_CAMERA = {
  exposure: { value: 1 },
  whiteBalance: { value: new Vector3(1, 1, 1) },
}

/**
 * AR-165 (Eduardo 2026-10-23): a passepartout's face at exactly its color looked "a little fake
 * (too perfect), too white … half baked half white color?". Half (0.5) was "still too gray": a
 * quarter of the room's light, the rest its color.
 */
export const PASSEPARTOUT_FACE_LIT = 0.25

/** three's Khronos PBR Neutral (`NeutralToneMapping`, the screen's tone mapping), exposure applied. */
const ROOM_NEUTRAL = /* glsl */ `
uniform float roomExposure;
uniform vec3 roomWhiteBalance;
vec3 roomNeutral( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= roomExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
`

/**
 * A part of the artwork shown past the screen effects in the baked look, like the image: the
 * passepartout's front face and the paper border. It writes the image's marker, so a white
 * passepartout reads white beside the picture wherever it hangs.
 *
 * `lit` 0: unlit, exactly its color (the paper border). Above 0 (the passepartout's face, AR-165):
 * lit by the room like the frame, it shows that share of what the room's camera makes of its light
 * (white balance, exposure, tone mapping — as the screen would), the rest its own color.
 */
export const createArtworkSurfaceMaterial = (
  color: ColorRepresentation,
  lit = 0,
): MeshBasicMaterial | MeshStandardMaterial => {
  if (lit <= 0) {
    const marker = ARTWORK_FILE_ALPHA.toFixed(2)
    const material = new MeshBasicMaterial({ color, side: DoubleSide })
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>\n\tgl_FragColor = vec4( diffuseColor.rgb, ${marker} );`,
      )
    }
    material.customProgramCacheKey = () => 'artwork-surface'
    return material
  }
  return Object.assign(
    new MeshStandardMaterial({ color, roughness: 1, side: DoubleSide }),
    shownPastScreenEffects(lit, false),
  )
}

/**
 * The shader hooks of a lit MeshStandardMaterial shown past the screen effects (the image's
 * marker): it shows `lit` of what the room's camera makes of its light, the rest its own color.
 * With `edges`, only where it faces front (+z of the object): rounded edges and sides turn
 * towards all of the room's light (a text card's).
 */
const shownPastScreenEffects = (lit: number, edges: boolean) => ({
  onBeforeCompile: (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.roomExposure = ROOM_CAMERA.exposure
    shader.uniforms.roomWhiteBalance = ROOM_CAMERA.whiteBalance
    const share = edges
      ? `mix( 1.0, ${lit.toFixed(2)}, smoothstep( 0.9, 0.999, vFrontness ) )`
      : lit.toFixed(2)
    if (edges)
      shader.vertexShader = `varying float vFrontness;\n${shader.vertexShader}`.replace(
        '#include <beginnormal_vertex>',
        '#include <beginnormal_vertex>\n\tvFrontness = objectNormal.z;',
      )
    shader.fragmentShader = `${edges ? 'varying float vFrontness;\n' : ''}${ROOM_NEUTRAL}\n${
      shader.fragmentShader
    }`.replace(
      '#include <opaque_fragment>',
      `#include <opaque_fragment>
\tvec3 roomShown = roomNeutral( outgoingLight * roomWhiteBalance );
\tgl_FragColor = vec4( mix( diffuseColor.rgb, roomShown, ${share} ), ${ARTWORK_FILE_ALPHA.toFixed(2)} );`,
    )
  },
  customProgramCacheKey: () => `artwork-surface-lit-${lit.toFixed(2)}${edges ? '-edges' : ''}`,
})

/**
 * AR-165 (Eduardo 2026-10-23): a text card gets "the same treatment we are giving to the
 * passepartout" — baked, its rounded edges were hair-thin strips in the card atlas and showed as a
 * dashed line.
 */
export const TEXT_CARD_FACE_LIT = PASSEPARTOUT_FACE_LIT

/** A text card's material hooks in the baked look: its face like a passepartout's, edges lit. */
export const TEXT_CARD_SHADING = shownPastScreenEffects(TEXT_CARD_FACE_LIT, true)

/**
 * For what is drawn ON a surface shown past the screen effects (a text card's text, border and
 * monogram): its color blends in as usual, the alpha under it stays — the card's marker (shown past
 * the effects, so it shows its own color too, edges blending cleanly) or the wall's 1.
 */
export const ON_ARTWORK_BLENDING = {
  blending: CustomBlending,
  blendEquation: AddEquation,
  blendSrc: SrcAlphaFactor,
  blendDst: OneMinusSrcAlphaFactor,
  blendSrcAlpha: ZeroFactor,
  blendDstAlpha: OneFactor,
} as const

/** The base material for troika text on a text card (troika derives its own from it). */
export const createOnArtworkTextMaterial = (): MeshBasicMaterial =>
  new MeshBasicMaterial({ side: DoubleSide, transparent: true, ...ON_ARTWORK_BLENDING })

/**
 * The undecoded twin of a cached artwork texture: a second Texture over the same image, with no
 * color space — three uploads it separately (the color space is part of its GPU texture), so the
 * sRGB texture every other material samples is never changed under them. One per texture, freed
 * with it (`disposeEncodedMap`).
 */
const encodedMaps = new Map<Texture, Texture>()

export const encodedMap = (texture: Texture): Texture => {
  if (!ARTWORK_ENCODED_SAMPLING) return texture
  let encoded = encodedMaps.get(texture)
  if (!encoded) {
    encoded = texture.clone()
    encoded.colorSpace = NoColorSpace
    encodedMaps.set(texture, encoded)
  }
  return encoded
}

export const disposeEncodedMap = (texture: Texture) => {
  encodedMaps.get(texture)?.dispose()
  encodedMaps.delete(texture)
}
