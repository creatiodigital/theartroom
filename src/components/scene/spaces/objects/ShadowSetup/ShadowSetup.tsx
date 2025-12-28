import { SoftShadows } from '@react-three/drei'

/**
 * Shared shadow configuration for all gallery spaces.
 * Uses PCSS (Percentage Closer Soft Shadows) for realistic soft-edged shadows.
 * Includes soft RectAreaLight for gallery-style diffused lighting.
 */
export const ShadowSetup = () => {
  return (
    <>
      {/* SoftShadows enables PCSS for realistic soft shadow edges */}
      <SoftShadows 
        size={25}
        focus={0.5}
        samples={10}
      />
      
      {/* Large rectangular area light for soft, diffused gallery lighting
          Positioned on ceiling, pointing down - creates even illumination
          without harsh specular highlights on floors */}
      <rectAreaLight
        position={[0, 9.5, 0]}
        rotation={[-Math.PI / 2, 0, 0]} // Point straight down
        width={20}
        height={20}
        intensity={1}
        color="#ffffff"
      />
      
      {/* Secondary smaller area light for subtle fill */}
      <rectAreaLight
        position={[0, 9.5, 5]}
        rotation={[-Math.PI / 2, 0, 0]}
        width={10}
        height={10}
        intensity={0.5}
        color="#f8f4f0" // Slightly warm
      />
      
      {/* Subtle spotlight for floor reflections */}
      <spotLight
        position={[0, 9, 0]}
        angle={Math.PI / 3}
        penumbra={1}
        intensity={0.3}
        color="#ffffff"
      />
    </>
  )
}

export default ShadowSetup
