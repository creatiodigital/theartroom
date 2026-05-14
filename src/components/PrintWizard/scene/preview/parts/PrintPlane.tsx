import type { Texture } from 'three'

interface PrintPlaneProps {
  widthM: number
  heightM: number
  texture: Texture
  roughness: number
  /** Z offset for the print plane. Each frame-type owner controls
   *  where the print sits in the depth stack. */
  z?: number
}

export const PrintPlane = ({ widthM, heightM, texture, roughness, z = 0 }: PrintPlaneProps) => (
  <mesh position={[0, 0, z]}>
    <planeGeometry args={[widthM, heightM]} />
    <meshStandardMaterial map={texture} roughness={roughness} />
  </mesh>
)
