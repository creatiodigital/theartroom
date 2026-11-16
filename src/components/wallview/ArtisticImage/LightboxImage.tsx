'use client'

import {
  LIGHTBOX_TINT,
  lightboxFilm,
} from '@/components/scene/spaces/objects/Lightbox/lightboxLook'
import { WALL_SCALE } from '@/components/wallview/constants'
import { assetUrl } from '@/lib/assetUrl'
import {
  LIGHTBOX_EDGE_CM,
  LIGHTBOX_SWATCH,
  type TLightbox,
  type TLightboxLight,
} from '@/lib/lightbox'

import styles from './ArtisticImage.module.scss'

/** Oak and walnut show the frame's woods, as a wooden frame does on the wall. */
const WOOD: Partial<Record<TLightbox['lightboxMaterial'], string>> = {
  oak: 'light',
  walnut: 'dark',
}

/** The room's light color (`LIGHTBOX_TINT`, linear) as a CSS color, its brightest channel full. */
const tintCss = (light: TLightboxLight): string => {
  const tint = LIGHTBOX_TINT[light]
  const max = Math.max(...tint)
  const encode = (v: number) => {
    const c = v / max
    return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055))
  }
  return `rgb(${tint.map(encode).join(', ')})`
}

type LightboxImageProps = {
  imageUrl: string
  lightbox: TLightbox
}

/**
 * AR-183 — a lightbox on the 2D wall (docs/lightbox "2D wall editor"): the box seen from the
 * front, its edge in its material, and the image a little brighter than a print, in the light's
 * color, so the artist sees which works are lightboxes. No glow in 2D. The container is already
 * the image plus the edge each side (`getArtworkBorderPx`).
 */
export function LightboxImage({ imageUrl, lightbox }: LightboxImageProps) {
  const edgePx = LIGHTBOX_EDGE_CM[lightbox.lightboxEdge] * (WALL_SCALE / 100)
  const wood = WOOD[lightbox.lightboxMaterial]
  // ?v=3 matches the 3D scene's wood-frame version → shared cache entry.
  const background = wood
    ? `url('${assetUrl(`/assets/materials/wooden-frame-${wood}/diffuse.jpg?v=3`)}') center / 100% repeat`
    : LIGHTBOX_SWATCH[lightbox.lightboxMaterial]

  return (
    <div
      className={styles.frame}
      data-lightbox=""
      style={{ padding: `${edgePx}px`, boxSizing: 'border-box', background }}
    >
      <div
        className={styles.image}
        style={{
          position: 'relative',
          backgroundImage: `url(${imageUrl})`,
          filter: `brightness(${(1.06 + 0.12 * lightbox.lightboxBrightness).toFixed(3)}) saturate(${lightboxFilm(lightbox.lightboxBrightness).saturation.toFixed(3)})`,
        }}
      >
        {lightbox.lightboxLight !== 'neutral' && (
          <div
            className={styles.lightboxTint}
            style={{ backgroundColor: tintCss(lightbox.lightboxLight) }}
          />
        )}
      </div>
    </div>
  )
}
