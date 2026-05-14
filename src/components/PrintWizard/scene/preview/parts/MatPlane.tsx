interface MatPlaneProps {
  widthM: number
  heightM: number
  colorHex: string
  z?: number
}

/**
 * Passepartout window-cut card layer. Sits between the paper sheet and
 * the moulding for Standard / Box frames when the buyer picks a mount.
 */
export const MatPlane = ({ widthM, heightM, colorHex, z = -0.0015 }: MatPlaneProps) => (
  <mesh position={[0, 0, z]}>
    <planeGeometry args={[widthM, heightM]} />
    <meshStandardMaterial color={colorHex} roughness={0.95} />
  </mesh>
)
