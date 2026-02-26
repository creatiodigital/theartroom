import { useMemo, useRef, useEffect } from 'react'
import { ShaderMaterial, Vector2 } from 'three'

// Shared vertex shader
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Shared fragment shader with vertical gradient (top lighter, bottom stronger)
const fragmentShader = `
  uniform vec2 uInnerSize;
  uniform vec2 uOuterSize;
  varying vec2 vUv;
  
  void main() {
    vec2 centered = vUv - 0.5;
    vec2 pos = centered * uOuterSize;
    
    vec2 innerHalf = uInnerSize * 0.5;
    vec2 outerHalf = uOuterSize * 0.5;
    
    // Discard pixels inside the inner rectangle (don't cover the artwork)
    if (abs(pos.x) < innerHalf.x && abs(pos.y) < innerHalf.y) {
      discard;
    }
    
    // Distance from inner rectangle edge (Euclidean for natural corners)
    vec2 d = abs(pos) - innerHalf;
    float dist = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
    
    // Blur from inner edge to outer edge
    float blurWidth = (outerHalf.x - innerHalf.x);
    float alpha = 1.0 - smoothstep(0.0, blurWidth, dist);
    
    // Vertical gradient: top nearly invisible (overhead light), bottom stronger
    // centered.y goes from -0.5 (bottom) to +0.5 (top)
    float verticalFade = mix(1.0, 0.1, smoothstep(-0.2, 0.2, centered.y));
    
    gl_FragColor = vec4(0.0, 0.0, 0.0, alpha * 0.45 * verticalFade);
  }
`

type ShadowDecalProps = {
  width: number
  height: number
  frameDepth?: number // Frame thickness in meters (0.01 to 0.20)
}

// Base blur size + proportional addition based on protrusion depth
const BASE_BLUR = 0.02
const DEPTH_MULTIPLIER = 1.5 // Depth-driven — thin supports stay tight, thick frames spread more

/**
 * Fake shadow decal component for artworks.
 * Uses a custom shader to create a smooth blur effect around the artwork.
 * Shadow size is proportional to frame depth (thicker frame = bigger shadow).
 * Returns null if no frame (frameDepth <= 0).
 */
export function ShadowDecal({ width, height, frameDepth = 0.05 }: ShadowDecalProps) {
  const materialRef = useRef<ShaderMaterial>(null)

  // No frame = no shadow
  if (frameDepth <= 0) return null

  // Blur size: base + subtle proportion of frame depth
  const blurSize = BASE_BLUR + frameDepth * DEPTH_MULTIPLIER

  const outerWidth = width + blurSize
  const outerHeight = height + blurSize

  // Memoize the uniforms object to prevent recreation
  const uniforms = useMemo(
    () => ({
      uInnerSize: { value: new Vector2(width, height) },
      uOuterSize: { value: new Vector2(outerWidth, outerHeight) },
    }),
    [],
  ) // Empty deps - we'll update uniforms manually

  // Update uniforms when dimensions change (avoids material recreation)
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uInnerSize.value.set(width, height)
      materialRef.current.uniforms.uOuterSize.value.set(outerWidth, outerHeight)
    }
  }, [width, height, outerWidth, outerHeight])

  return (
    <mesh position={[0, 0, 0.001]} renderOrder={0}>
      <planeGeometry args={[outerWidth, outerHeight]} />
      <shaderMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
      />
    </mesh>
  )
}

export default ShadowDecal
