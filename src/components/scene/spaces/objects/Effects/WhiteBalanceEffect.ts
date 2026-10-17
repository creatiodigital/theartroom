import { Effect } from 'postprocessing'
import { Uniform, Vector3 } from 'three'

/**
 * ⚠️ AR-161 SPIKE — camera white balance: per-channel gain on linear HDR, before tone mapping,
 * exactly what a camera's WB setting does. Set from the mounted lamps' colour, so a warm
 * lamp's light reads white on a white wall — as it does to the eye and in a photograph.
 */
export class WhiteBalanceEffect extends Effect {
  constructor() {
    super(
      'WhiteBalanceEffect',
      /* glsl */ `
        uniform vec3 gain;
        void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
          outputColor = vec4(inputColor.rgb * gain, inputColor.a);
        }
      `,
      { uniforms: new Map([['gain', new Uniform(new Vector3(1, 1, 1))]]) },
    )
  }

  setGain(gain: [number, number, number]) {
    ;(this.uniforms.get('gain')!.value as Vector3).set(...gain)
  }
}
