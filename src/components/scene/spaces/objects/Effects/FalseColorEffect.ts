import { Effect } from 'postprocessing'
import { Uniform } from 'three'

/**
 * ⚠️ AR-169 calibration instrument (development, `?falsecolor=1`; plan
 * docs/superpowers/plans/2026-10-30-lighting-calibration.md, phase 1): the image as exposure bands
 * instead of the tone curve. In the tone mapper's slot, after bloom and white balance: Rec. 709
 * luminance × the camera's exposure, in stops over middle grey (0.18) — where a curve would put
 * each part of the room, whichever curve it is.
 *
 * Bands (stops over grey; our own, from the research notes' tone-curve facts, not Blender's):
 *
 * | stops       | color  | reading                                    |
 * |-------------|--------|--------------------------------------------|
 * | < −6        | black  | crushed                                    |
 * | −6 … −4     | purple | deep shadow                                |
 * | −4 … −2     | blue   | shadow                                     |
 * | −2 … −0.5   | cyan   | low mids                                   |
 * | −0.5 … +0.5 | grey   | middle grey                                |
 * | +0.5 … +2   | green  | upper mids (a lit white wall's target)     |
 * | +2 … +3.5   | yellow | highlights: Khronos Neutral's shoulder     |
 * | +3.5 … +6.5 | orange | AgX still grades it; Neutral is flat white |
 * | > +6.5      | red    | clips under every curve                    |
 */
export const FALSE_COLOR_BANDS = [
  { below: -6, name: 'black', srgb: [0, 0, 0] },
  { below: -4, name: 'purple', srgb: [90, 0, 160] },
  { below: -2, name: 'blue', srgb: [0, 70, 255] },
  { below: -0.5, name: 'cyan', srgb: [0, 200, 220] },
  { below: 0.5, name: 'grey', srgb: [128, 128, 128] },
  { below: 2, name: 'green', srgb: [40, 200, 40] },
  { below: 3.5, name: 'yellow', srgb: [255, 230, 0] },
  { below: 6.5, name: 'orange', srgb: [255, 128, 0] },
  { below: Infinity, name: 'red', srgb: [255, 0, 0] },
] as const

// The composer encodes its output to sRGB: the shader writes each band's linear value.
const linear = (c: number) => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
const glslColor = (srgb: readonly number[]) =>
  `vec3(${srgb.map((c) => linear(c).toFixed(6)).join(', ')})`

const bandsGlsl = FALSE_COLOR_BANDS.map((band, i) =>
  i === FALSE_COLOR_BANDS.length - 1
    ? `      ${glslColor(band.srgb)};`
    : `      s < ${band.below.toFixed(1)} ? ${glslColor(band.srgb)} :`,
).join('\n')

export class FalseColorEffect extends Effect {
  constructor() {
    super(
      'FalseColorEffect',
      /* glsl */ `
        uniform float exposure;
        void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
          float L = dot(inputColor.rgb * exposure, vec3(0.2126, 0.7152, 0.0722));
          float s = log2(max(L, 1e-9) / 0.18);
          vec3 c =
${bandsGlsl}
          outputColor = vec4(c, inputColor.a);
        }
      `,
      { uniforms: new Map([['exposure', new Uniform(1)]]) },
    )
  }

  setExposure(exposure: number) {
    this.uniforms.get('exposure')!.value = exposure
  }
}
