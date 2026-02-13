import { useSelector } from 'react-redux'
import { BufferGeometry, DoubleSide } from 'three'
import type { RootState } from '@/redux/store'

interface CeilingGlassProps {
  geometry: BufferGeometry
}

const DEFAULT_SKYLIGHT_COLOR = '#ffffff'
const DEFAULT_SKYLIGHT_INTENSITY = 4.0

/**
 * Glass ceiling with emissive glow to simulate skylight source.
 */
const CeilingGlass: React.FC<CeilingGlassProps> = ({ geometry }) => {
  const skylightColor = useSelector(
    (state: RootState) => state.exhibition.skylightColor ?? DEFAULT_SKYLIGHT_COLOR,
  )
  const skylightIntensity = useSelector(
    (state: RootState) => state.exhibition.skylightIntensity ?? DEFAULT_SKYLIGHT_INTENSITY,
  )

  // Emissive intensity scaled from light intensity
  const emissiveIntensity = skylightIntensity * 3

  return (
    <mesh key={`glass-${skylightColor}-${emissiveIntensity}`} name="top" geometry={geometry}>
      <meshStandardMaterial
        color={skylightColor}
        emissive={skylightColor}
        emissiveIntensity={emissiveIntensity}
        side={DoubleSide}
      />
    </mesh>
  )
}

export default CeilingGlass
