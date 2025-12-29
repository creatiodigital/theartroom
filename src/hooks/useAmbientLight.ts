import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Color } from 'three'

import type { RootState } from '@/redux/store'

/**
 * Hook that returns a Three.js Color adjusted for ambient light settings.
 * Use this for materials with baked textures that should still respond to ambient light changes.
 *
 * @param baseColor - The base color of the material (hex string like '#ffffff' or Color instance)
 * @param multiplier - Optional intensity multiplier (default 1.5 for good brightness at intensity=1.0)
 * @returns A Three.js Color instance adjusted for current ambient light
 *
 * @example
 * const floorColor = useAmbientLightColor('#ffffff')
 * material.color = floorColor
 *
 * @example
 * // With custom base color
 * const frameColor = useAmbientLightColor(artwork.frameColor ?? '#000000')
 */
export const useAmbientLightColor = (
  baseColor: string | Color = '#ffffff',
  multiplier: number = 1.5,
): Color => {
  const ambientColor = useSelector(
    (state: RootState) => state.exhibition.ambientLightColor ?? '#ffffff',
  )
  const ambientIntensity = useSelector(
    (state: RootState) => state.exhibition.ambientLightIntensity ?? 1,
  )

  return useMemo(() => {
    const color = new Color(baseColor)
    const ambient = new Color(ambientColor)
    const scale = Math.min(Math.max(ambientIntensity * multiplier, 0.2), 3)
    ambient.multiplyScalar(scale)
    color.multiply(ambient)
    return color
  }, [baseColor, ambientColor, ambientIntensity, multiplier])
}

/**
 * Hook that returns ambient light settings for use with materials.
 * Returns both color and a pre-calculated scale factor.
 *
 * @returns Object with ambientColor, ambientIntensity, and calculated scale
 */
export const useAmbientLight = () => {
  const ambientColor = useSelector(
    (state: RootState) => state.exhibition.ambientLightColor ?? '#ffffff',
  )
  const ambientIntensity = useSelector(
    (state: RootState) => state.exhibition.ambientLightIntensity ?? 1,
  )

  return useMemo(
    () => ({
      ambientColor,
      ambientIntensity,
      scale: Math.min(Math.max(ambientIntensity * 1.5, 0.2), 3),
    }),
    [ambientColor, ambientIntensity],
  )
}

export default useAmbientLightColor
