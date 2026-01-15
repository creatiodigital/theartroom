import { useMemo } from 'react'
import { useDispatch } from 'react-redux'
import {
  MeshStandardMaterial,
  EdgesGeometry,
  LineDashedMaterial,
  Mesh,
  BufferGeometry,
} from 'three'

import { hideArtworkPanel } from '@/redux/slices/dashboardSlice'
import { snapshotExhibition } from '@/redux/slices/exhibitionSlice'
import { showWallView } from '@/redux/slices/wallViewSlice'

interface PlaceholderProps {
  i: number
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
}

const Placeholder: React.FC<PlaceholderProps> = ({ i, nodes }) => {
  const dispatch = useDispatch()

  const dashedLineMaterial = useMemo(() => {
    return new LineDashedMaterial({
      color: '#555555',
      dashSize: 0.1,
      gapSize: 0.05,
      linewidth: 4,
    })
  }, [])

  const getPlaceholderMaterial = useMemo(() => {
    return () =>
      new MeshStandardMaterial({
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
      })
  }, [])

  const handleOnPlaceholderClick = (mesh: Mesh) => {
    // Snapshot current exhibition state before opening wall view
    // This allows Cancel to restore the original state
    dispatch(snapshotExhibition())
    // Use mesh.name instead of mesh.uuid for stable identification across page loads
    dispatch(showWallView(mesh.name))
    dispatch(hideArtworkPanel())
  }

  const meshKey = `placeholder${i}`
  const geometry = nodes[meshKey].geometry

  return (
    <>
      <mesh
        name={meshKey}
        castShadow
        receiveShadow
        onDoubleClick={() => handleOnPlaceholderClick(nodes[meshKey])}
        geometry={geometry}
        material={getPlaceholderMaterial()}
      />
      <lineSegments
        geometry={new EdgesGeometry(geometry)}
        material={dashedLineMaterial}
        onUpdate={(self) => self.computeLineDistances()}
      />
    </>
  )
}

export default Placeholder
