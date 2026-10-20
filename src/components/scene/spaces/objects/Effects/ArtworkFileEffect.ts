import { Effect } from 'postprocessing'

import { ARTWORK_FILE_ALPHA } from '@/components/scene/spaces/objects/Display/artworkFile'

/**
 * ⚠️ AR-161 (the baked look) — the LAST screen effect: wherever an artwork image wrote
 * its file colour (marked by alpha ARTWORK_FILE_ALPHA in the scene render), show that colour
 * exactly, undoing bloom, white balance, exposure and tone mapping for those pixels. The output
 * stage then encodes it to sRGB, so the picture on screen is the file. Antialiased edges (alpha
 * between the marker and 1) blend by the share of the pixel the image covers; the marker never
 * reaches the canvas (alpha back to 1).
 */
export class ArtworkFileEffect extends Effect {
  constructor() {
    super(
      'ArtworkFileEffect',
      /* glsl */ `
        void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
          vec4 scene = texture2D(inputBuffer, uv);
          float marker = ${ARTWORK_FILE_ALPHA.toFixed(2)};
          bool solid = scene.a >= marker - 0.05;
          float share = solid ? clamp((1.0 - scene.a) / (1.0 - marker), 0.0, 1.0) : 0.0;
          // The marker must not reach the canvas: a half-transparent pixel lets the page show
          // through (washed-out pictures). Image and opaque room pixels leave fully opaque.
          outputColor = vec4(mix(inputColor.rgb, scene.rgb, share), solid ? 1.0 : inputColor.a);
        }
      `,
    )
  }
}
