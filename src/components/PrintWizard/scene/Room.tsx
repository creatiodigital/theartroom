'use client'

/**
 * Minimal backdrop: a single frontal wall plane.
 * Kept deliberately simple — furniture/props can be added later.
 */
export const Room = () => {
  return (
    // Wider/shorter wall, bottom-aligned to the floor (y = -1.5).
    <mesh position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[5, 3]} />
      <meshStandardMaterial color="#f5f2ec" roughness={0.95} />
    </mesh>
  )
}
