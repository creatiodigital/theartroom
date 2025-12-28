import { Mesh, BufferGeometry, Material } from 'three'

interface RectLampProps {
  i: number
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
  rectLampMaterial: Material
}

const RectLamp: React.FC<RectLampProps> = ({ i, nodes, rectLampMaterial }) => {
  const lampNode = nodes[`rectlamp${i}`]
  if (!lampNode) return null
  
  return (
    <mesh
      name={`rectlamp${i}`}
      geometry={lampNode.geometry}
      material={rectLampMaterial}
    />
  )
}

export default RectLamp
