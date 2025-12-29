import { AmbientLight } from './AmbientLight'
import { HDRI } from './HDRI'
import { ShadowSetup } from '@/components/scene/spaces/objects/ShadowSetup'

// Ceiling light positions (adjust these to match your Blender layout)
const ceilingLightPositions = [
  [-4, 9.5, -3],
  [0, 9.5, -3],
  [4, 9.5, -3],
  [-4, 9.5, 3],
  [0, 9.5, 3],
  [4, 9.5, 3],
]

export const Lights = () => {
  return (
    <>
      <AmbientLight />
      <HDRI />
      <ShadowSetup />

      {/* RectAreaLights at ceiling fixture positions */}
      {ceilingLightPositions.map((pos, i) => (
        <rectAreaLight
          key={i}
          position={pos as [number, number, number]}
          rotation={[-Math.PI / 2, 0, 0]}
          width={0.4}
          height={0.4}
          intensity={8}
          color="#ffffff"
        />
      ))}
    </>
  )
}
