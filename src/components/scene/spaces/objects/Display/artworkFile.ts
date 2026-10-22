import {
  DoubleSide,
  MeshBasicMaterial,
  NoColorSpace,
  type ColorRepresentation,
  type Texture,
} from 'three'

/**
 * ⚠️ AR-161 (spec rule 1, the sine qua non) — in the baked look an artwork IMAGE shows exactly its
 * file: no light, exposure, white balance, tone curve, tint or glow on it, even where it then
 * doesn't match the room's light. The image writes its texel (the file's linear color) with alpha
 * ARTWORK_FILE_ALPHA as a marker; the last screen effect (`ArtworkFileEffect`) puts that color back
 * over whatever bloom, white balance, exposure and tone mapping made of it. The passepartout and
 * the paper border count as part of the image (AR-163, Eduardo 2026-10-21: "we need to be able to
 * show a perfectly white passepartout as well as an unaltered picture") and show their own color
 * the same way (`createArtworkSurfaceMaterial`). Frame, card and room stay physically lit.
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
 * A part of the artwork that shows exactly its color in the baked look, like the image: the
 * passepartout and the paper border. Unlit, it writes its color with the image's marker, so a
 * white passepartout is white beside the picture wherever it hangs.
 */
export const createArtworkSurfaceMaterial = (color: ColorRepresentation): MeshBasicMaterial => {
  const material = new MeshBasicMaterial({ color, side: DoubleSide })
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `#include <opaque_fragment>\n\tgl_FragColor = vec4( diffuseColor.rgb, ${ARTWORK_FILE_ALPHA.toFixed(2)} );`,
    )
  }
  material.customProgramCacheKey = () => 'artwork-surface'
  return material
}

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
