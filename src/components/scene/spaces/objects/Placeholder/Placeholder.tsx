import type { ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import {
  MeshBasicMaterial,
  EdgesGeometry,
  LineDashedMaterial,
  Mesh,
  BufferGeometry,
  LineSegments,
} from 'three'

import { snapshotArtworks } from '@/redux/slices/artworkSlice'
import {
  hideArtworkPanel,
  hideFloorPanel,
  hideLightingPanel,
  hideCameraPanel,
  hidePanelsPanel,
} from '@/redux/slices/dashboardSlice'
import { snapshotExhibition } from '@/redux/slices/exhibitionSlice'
import { showWallView } from '@/redux/slices/wallViewSlice'
import { useDisposable } from '@/components/scene/spaces/objects/useDisposable'

interface PlaceholderProps {
  i?: number
  /**
   * Node name to render, when it isn't the `placeholder{i}` of a room wall.
   * Display panels pass their own faces here — `panelFront0`, `panelBack0` —
   * so a panel face gets the same dashed outline and the same double-click
   * into the 2D canvas as any other wall.
   */
  name?: string
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
}

const Placeholder: React.FC<PlaceholderProps> = ({ i, name, nodes }) => {
  const dispatch = useDispatch()
  const lineRef = useRef<LineSegments>(null)

  const meshKey = name ?? `placeholder${i}`
  const node = nodes[meshKey]

  const dashedLineMaterial = useMemo(() => {
    return new LineDashedMaterial({
      color: '#555555',
      dashSize: 0.1,
      gapSize: 0.05,
      linewidth: 4,
    })
  }, [])

  const placeholderMaterial = useMemo(() => {
    return new MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
    })
  }, [])
  useDisposable(placeholderMaterial)

  // Memoize EdgesGeometry — previously recreated every render frame
  const edgesGeometry = useMemo(() => {
    if (!node) return null
    return new EdgesGeometry(node.geometry)
  }, [node])

  // Compute line distances once after mount
  useEffect(() => {
    if (lineRef.current) {
      lineRef.current.computeLineDistances()
    }
  }, [edgesGeometry])

  const handleOnPlaceholderClick = (event: ThreeEvent<MouseEvent>, mesh: Mesh) => {
    // R3F raycasts THROUGH the scene: without this, the handler fires on every
    // placeholder the ray crosses, nearest first, and the last dispatch wins.
    // Double-clicking a display panel would open the panel's face and then
    // immediately be overwritten by the room wall standing behind it.
    event.stopPropagation()

    dispatch(snapshotExhibition())
    dispatch(snapshotArtworks())
    dispatch(showWallView(mesh.name))
    dispatch(hideArtworkPanel())
    dispatch(hideFloorPanel())
    dispatch(hideLightingPanel())
    dispatch(hideCameraPanel())
    dispatch(hidePanelsPanel())
  }

  if (!node) return null

  return (
    <>
      <mesh
        name={meshKey}
        onDoubleClick={(event) => handleOnPlaceholderClick(event, nodes[meshKey])}
        geometry={node.geometry}
        material={placeholderMaterial}
        position={node.position}
        rotation={node.rotation}
        scale={node.scale}
      />
      <lineSegments
        ref={lineRef}
        geometry={edgesGeometry!}
        material={dashedLineMaterial}
        position={node.position}
        rotation={node.rotation}
        scale={node.scale}
      />
    </>
  )
}

export default Placeholder
