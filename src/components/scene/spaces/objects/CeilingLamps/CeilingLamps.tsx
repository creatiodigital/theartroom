import { useSelector } from 'react-redux'
import { BufferGeometry, DoubleSide } from 'three'
import type { RootState } from '@/redux/store'

interface CeilingLampsProps {
  geometry: BufferGeometry
}

const DEFAULT_LAMP_COLOR = '#ffffff'

/**
 * Small ceiling lamps with emissive glow.
 * Reads directly from Redux for reactivity.
 */
const CeilingLamps: React.FC<CeilingLampsProps> = ({ geometry }) => {
  const lampColor = useSelector(
    (state: RootState) => state.exhibition.ceilingLampColor ?? DEFAULT_LAMP_COLOR,
  )

  const bulbEmissiveIntensity = 2

  return (
    <mesh key={`lamps-${lampColor}-${bulbEmissiveIntensity}`} name="rectlamp0" geometry={geometry}>
      <meshStandardMaterial
        color="#000000"
        emissive={lampColor}
        emissiveIntensity={bulbEmissiveIntensity}
        toneMapped={false}
        side={DoubleSide}
      />
    </mesh>
  )
}

export { CeilingLamps }
export default CeilingLamps

