'use client'

/**
 * Minimal backdrop: a single frontal wall plane.
 * Kept deliberately simple — furniture/props can be added later.
 */
export const Room = () => {
  return (
    // Oversized wall so wide/ultrawide canvases (when the wizard's center
    // column fills the viewport) never show past the plane's edges.
    <mesh position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[16, 6]} />
      <meshStandardMaterial color="#f5f2ec" roughness={0.95} />
    </mesh>
  )
}
