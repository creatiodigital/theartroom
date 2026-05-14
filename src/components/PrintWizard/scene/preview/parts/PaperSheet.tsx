interface PaperSheetProps {
  widthM: number
  heightM: number
  roughness: number
  z?: number
}

export const PaperSheet = ({ widthM, heightM, roughness, z = -0.001 }: PaperSheetProps) => (
  <mesh position={[0, 0, z]}>
    <planeGeometry args={[widthM, heightM]} />
    <meshStandardMaterial color="#ffffff" roughness={roughness} />
  </mesh>
)
