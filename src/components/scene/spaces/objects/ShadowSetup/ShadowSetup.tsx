import { SoftShadows } from '@react-three/drei'

/**
 * Shared shadow configuration for all gallery spaces.
 * Uses PCSS (Percentage Closer Soft Shadows) for realistic soft-edged shadows.
 * 
 * Can be imported into any space's Lights component.
 */
export const ShadowSetup = () => {
  return (
    <>
      {/* SoftShadows enables PCSS for realistic soft shadow edges */}
      <SoftShadows 
        size={25}      // Size of the light source (larger = softer shadows)
        focus={0.5}    // Focus of the shadow (lower = softer falloff)
        samples={10}   // Number of samples (more = smoother but slower)
      />
      
      {/* Main directional light for casting shadows from above */}
      <directionalLight
        position={[5, 10, 5]}
        intensity={0.3}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-bias={-0.0001}
      />
      
      {/* Low-angle "raking" light to enhance normal map bump visibility */}
      <directionalLight
        position={[10, 2, 0]}
        intensity={0.4}
        color="#fff5e6"
      />
    </>
  )
}

export default ShadowSetup
