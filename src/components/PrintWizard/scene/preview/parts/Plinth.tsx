interface PlinthProps {
  widthM: number
  heightM: number
  /** Depth in metres — how far the plinth lifts the print off the
   *  backboard. */
  depthM: number
  colorHex: string
  /** World z of the plinth's FRONT face. Set this just behind the
   *  print plane (e.g. -0.001) so the plinth is fully occluded by
   *  the print and doesn't z-fight with it. */
  frontZ?: number
}

/**
 * Hidden support block under a Dibond-mounted Floating print. The print
 * sits on top of this; the block itself should not be visible from a
 * front-on camera, only contributing depth so the print reads as
 * suspended above the backboard.
 */
export const Plinth = ({ widthM, heightM, depthM, colorHex, frontZ = -0.001 }: PlinthProps) => (
  <mesh position={[0, 0, frontZ - depthM / 2]}>
    <boxGeometry args={[widthM, heightM, depthM]} />
    <meshStandardMaterial color={colorHex} roughness={0.85} />
  </mesh>
)
