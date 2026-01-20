import { useSelector } from 'react-redux'
import { Mesh, BufferGeometry, Material } from 'three'
import type { RootState } from '@/redux/store'

interface WindowProps {
  i: number
  windowRef: React.Ref<Mesh>
  glassRef: React.Ref<Mesh>
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
  windowMaterial: Material
  glassMaterial: Material
}

const DEFAULT_WINDOW_LIGHT_INTENSITY = 4.0
const DEFAULT_WINDOW_LIGHT_COLOR = '#ffffff'

const Window: React.FC<WindowProps> = ({
  i,
  windowRef,
  glassRef,
  nodes,
  windowMaterial,
}) => {
  // Read from Redux for dynamic control
  const windowLightIntensity = useSelector(
    (state: RootState) => state.exhibition.windowLightIntensity ?? DEFAULT_WINDOW_LIGHT_INTENSITY,
  )
  const windowLightColor = useSelector(
    (state: RootState) => state.exhibition.windowLightColor ?? DEFAULT_WINDOW_LIGHT_COLOR,
  )

  // Scale slider (0-10) to emissive intensity
  const emissiveIntensity = windowLightIntensity * 0.5

  return (
    <>
      <mesh
        name={`window${i}`}
        ref={windowRef}
        castShadow
        receiveShadow
        geometry={nodes[`window${i}`]?.geometry}
        material={windowMaterial}
      />
      <mesh
        key={`glass-${i}-${windowLightColor}-${emissiveIntensity}`}
        ref={glassRef}
        name={`glass${i}`}
        geometry={nodes[`glass${i}`]?.geometry}
      >
        <meshStandardMaterial
          color={windowLightColor}
          emissive={windowLightColor}
          emissiveIntensity={emissiveIntensity}
        />
      </mesh>
    </>
  )
}

export default Window
