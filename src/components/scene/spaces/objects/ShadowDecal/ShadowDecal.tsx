import { useMemo, useRef, useEffect } from 'react'
import { ShaderMaterial, Vector2, NormalBlending } from 'three'

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
  uniform float uMaxOpacity;
  uniform float uDirection;
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
    
    // Vertical gradient: controlled by uDirection uniform
    // uDirection = 0.0 → mostly below, some on sides
    // uDirection = 1.0 → uniform shadow all around
    float verticalFade = mix(1.0, uDirection, smoothstep(-0.2, 0.2, centered.y));
    
    gl_FragColor = vec4(0.0, 0.0, 0.0, alpha * uMaxOpacity * verticalFade);
  }
`

type ShadowDecalProps = {
  width: number
  height: number
  frameDepth?: number // Frame/support thickness in meters (0.01 to 0.20)
  blur?: number // Base blur size (exhibition-level, default 0.025)
  spread?: number // Depth multiplier for blur spread (exhibition-level, default 1.2)
  opacity?: number // Max opacity cap (exhibition-level, default 0.25)
  direction?: number // Vertical fade: 0 = below only, 1 = uniform (default 0.2)
}

/**
 * Fake shadow decal component for artworks.
 * Uses a custom shader to create a smooth blur effect around the artwork.
 * Shadow size is proportional to frame/support depth (thicker = bigger shadow).
 * Blur, spread, and opacity are configurable per-exhibition via the Lighting Panel.
 * Returns null if no frame/support (frameDepth <= 0).
 */
export function ShadowDecal({
  width,
  height,
  frameDepth = 0.05,
  blur = 0.025,
  spread = 1.2,
  opacity = 0.25,
  direction = 0.2,
}: ShadowDecalProps) {
  const materialRef = useRef<ShaderMaterial>(null)

  // Blur size: exhibition base blur + proportional to frame/support depth
  const blurSize = blur + frameDepth * spread

  const outerWidth = width + blurSize
  const outerHeight = height + blurSize

  // Scale opacity: exhibition cap × artwork-size factor (larger artworks get stronger shadows)
  const diagonal = Math.sqrt(width * width + height * height)
  const maxOpacity = Math.min(opacity, Math.max(opacity * 0.4, diagonal * opacity * 1.2))

  // Memoize the uniforms object to prevent recreation
  const uniforms = useMemo(
    () => ({
      uInnerSize: { value: new Vector2(width, height) },
      uOuterSize: { value: new Vector2(outerWidth, outerHeight) },
      uMaxOpacity: { value: maxOpacity },
      uDirection: { value: direction },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  ) // Empty deps - we'll update uniforms manually

  // Update uniforms when dimensions change (avoids material recreation)
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uInnerSize.value.set(width, height)
      materialRef.current.uniforms.uOuterSize.value.set(outerWidth, outerHeight)
      materialRef.current.uniforms.uMaxOpacity.value = maxOpacity
      materialRef.current.uniforms.uDirection.value = direction
    }
  }, [width, height, outerWidth, outerHeight, maxOpacity, direction])

  // No frame = no shadow (after hooks to maintain consistent hook count)
  if (frameDepth <= 0) return null

  return (
    <mesh position={[0, 0, 0.001]} renderOrder={0}>
      <planeGeometry args={[outerWidth, outerHeight]} />
      <shaderMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        blending={NormalBlending}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
      />
    </mesh>
  )
}

export default ShadowDecal
