import { useSelector } from 'react-redux'
import { BufferGeometry, DoubleSide } from 'three'
import type { RootState } from '@/redux/store'

interface CeilingLampsProps {
  geometry: BufferGeometry
}

const DEFAULT_LAMP_COLOR = '#ffffff'
const DEFAULT_LAMP_INTENSITY = 4.0 // User-friendly 0-10 range

/**
 * Small ceiling lamps with emissive glow.
 * Reads directly from Redux for reactivity.
 */
const CeilingLamps: React.FC<CeilingLampsProps> = ({ geometry }) => {
  const lampColor = useSelector(
    (state: RootState) => state.exhibition.ceilingLampColor ?? DEFAULT_LAMP_COLOR,
  )
  const lampIntensity = useSelector(
    (state: RootState) => state.exhibition.ceilingLampIntensity ?? DEFAULT_LAMP_INTENSITY,
  )

  // Scale user-friendly 0-10 to actual emissive intensity (0-500 range)
  const emissiveIntensity = lampIntensity * 50

  return (
    <mesh key={`lamps-${lampColor}-${emissiveIntensity}`} name="rectlamp0" geometry={geometry}>
      <meshStandardMaterial
        color={lampColor}
        emissive={lampColor}
        emissiveIntensity={emissiveIntensity}
        side={DoubleSide}
      />
    </mesh>
  )
}

export { CeilingLamps }
export default CeilingLamps

