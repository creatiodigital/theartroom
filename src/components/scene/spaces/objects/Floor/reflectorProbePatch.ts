import type { Material, WebGLProgramParametersWithUniforms, WebGLRenderer } from 'three'

/**
 * ⚠️ AR-161 REALISM PROBE — DEV-ONLY, THROWAWAY. DO NOT SHIP AS-IS.
 *
 * Two diagnostic patches on drei's MeshReflectorMaterial shader (drei 10.7.7,
 * materials/MeshReflectorMaterial.js), installed only while the probe's floor override is on:
 *
 * 1. Reflection mode. drei MULTIPLIES the floor albedo by the reflection —
 *    `diffuseColor *= (1 - mirror) + reflection × mixStrength` — so a reflection reads as a stain
 *    in the wood rather than gloss on top of it. Mode 1 instead ADDS it as emissive weighted by
 *    Schlick Fresnel (weak looking down, strong at grazing angles, like a real finished floor).
 *    Mode 2 shows the reflection alone.
 *
 * 2. UV fix. drei samples `normalMap` and `roughnessMap` for the reflection with the RAW plane
 *    UV (`vUv`), not the transformed map UV, so one texture tile is stretched across the whole
 *    room (and `normalScale` is misused as a UV multiplier). The fix samples them with three's
 *    per-map varyings, so the reflection's wobble and blur follow the actual planks.
 */

const DREI_MIX_LINE =
  'diffuseColor.rgb = diffuseColor.rgb * ((1.0 - min(1.0, mirror)) + newMerge.rgb * mixStrength);'

export interface ReflectorProbeUniforms {
  uReflMode: { value: number }
  uFresnelF0: { value: number }
}

export const createReflectorProbeUniforms = (): ReflectorProbeUniforms => ({
  uReflMode: { value: 0 },
  uFresnelF0: { value: 0.04 },
})

type CompileHook = (shader: WebGLProgramParametersWithUniforms, renderer: WebGLRenderer) => void

/** Install (or remove) the patch on a live reflector material. Triggers a recompile. */
export const setReflectorProbePatch = (
  material: Material,
  uniforms: ReflectorProbeUniforms,
  options: { enabled: boolean; fixUv: boolean },
) => {
  const proto = Object.getPrototypeOf(material) as { onBeforeCompile: CompileHook }

  if (!options.enabled) {
    Reflect.deleteProperty(material, 'onBeforeCompile')
    Reflect.deleteProperty(material, 'customProgramCacheKey')
    material.needsUpdate = true
    return
  }

  material.onBeforeCompile = (shader, renderer) => {
    proto.onBeforeCompile.call(material, shader, renderer)

    shader.uniforms.uReflMode = uniforms.uReflMode
    shader.uniforms.uFresnelF0 = uniforms.uFresnelF0
    shader.fragmentShader = `uniform int uReflMode;\nuniform float uFresnelF0;\n${shader.fragmentShader}`
    shader.fragmentShader = shader.fragmentShader.replace(
      DREI_MIX_LINE,
      `if (uReflMode == 0) {
        ${DREI_MIX_LINE}
      } else {
        float ar161NdV = clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
        float ar161F = uFresnelF0 + (1.0 - uFresnelF0) * pow(1.0 - ar161NdV, 5.0);
        if (uReflMode == 1) {
          totalEmissiveRadiance += newMerge.rgb * mixStrength * ar161F;
        } else {
          diffuseColor.rgb = vec3(0.0);
          totalEmissiveRadiance = newMerge.rgb;
        }
      }`,
    )

    if (options.fixUv) {
      shader.fragmentShader = shader.fragmentShader
        .replace('texture2D(normalMap, vUv * normalScale)', 'texture2D(normalMap, vNormalMapUv)')
        .replace('texture2D( roughnessMap, vUv )', 'texture2D( roughnessMap, vRoughnessMapUv )')
    }
  }
  // The default key is `onBeforeCompile.toString()`, which cannot see `fixUv`.
  material.customProgramCacheKey = () => `ar161-floor-${options.fixUv ? 'uvfix' : 'drei-uv'}`
  material.needsUpdate = true
}
