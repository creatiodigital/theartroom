import { useSelector } from 'react-redux'
import { Mesh, BufferGeometry, Material } from 'three'
import type { RootState } from '@/redux/store'

interface LampProps {
  i: number
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
  lampMaterial: Material
  bulbMaterial?: Material // Optional - will use Redux state if not provided
}

const DEFAULT_LAMP_COLOR = '#ffffff'
const DEFAULT_LAMP_INTENSITY = 4.0

const Lamp: React.FC<LampProps> = ({ i, nodes, lampMaterial, bulbMaterial }) => {
  // Read from Redux for dynamic control
  const lampColor = useSelector(
    (state: RootState) => state.exhibition.ceilingLampColor ?? DEFAULT_LAMP_COLOR,
  )
  const lampIntensity = useSelector(
    (state: RootState) => state.exhibition.ceilingLampIntensity ?? DEFAULT_LAMP_INTENSITY,
  )

  // Scale user-friendly 0-10 to actual emissive intensity
  const emissiveIntensity = lampIntensity * 5

  return (
    <>
      <mesh
        name={`top${i}`}
        castShadow
        receiveShadow
        geometry={nodes[`top${i}`]?.geometry}
        material={lampMaterial}
      />
      <mesh
        name={`base${i}`}
        castShadow
        receiveShadow
        geometry={nodes[`base${i}`]?.geometry}
        material={lampMaterial}
      />
      <mesh
        name={`stick${i}`}
        castShadow
        receiveShadow
        geometry={nodes[`stick${i}`]?.geometry}
        material={lampMaterial}
      />
      <mesh
        key={`bulb-${i}-${lampColor}-${emissiveIntensity}`}
        name={`bulb${i}`}
        castShadow
        receiveShadow
        geometry={nodes[`bulb${i}`]?.geometry}
      >
        <meshStandardMaterial
          color={lampColor}
          emissive={lampColor}
          emissiveIntensity={emissiveIntensity}
        />
      </mesh>
    </>
  )
}

export default Lamp
