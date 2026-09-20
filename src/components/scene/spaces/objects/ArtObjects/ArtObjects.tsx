import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Vector3, Quaternion, type Matrix4, type Mesh } from 'three'

import { getSpaceConfig, type SpaceKey } from '@/components/scene/constants'
import { ArtObject } from '@/components/scene/spaces/objects/ArtObject'
import {
  isPanelEnabled,
  panelIndexOfFace,
  panelMatrix,
  panelPivot,
} from '@/components/scene/spaces/objects/Panel/panelSettings'
import { LAYER_DEPTH_STEP, layerRankById, type LayerItem } from '@/components/wallview/layerOrder'
import type { RootState } from '@/redux/store'
import type { TArtwork } from '@/types/artwork'

type ArtworkWithPosition = TArtwork & {
  position: Vector3
  quaternion: Quaternion
  width: number
  height: number
}

const ArtObjects = () => {
  const allArtworkIds = useSelector((state: RootState) => state.artworks.allIds)
  const artworksById = useSelector((state: RootState) => state.artworks.byId)
  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )

  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId) as SpaceKey | null
  const panelSettings = useSelector((state: RootState) => state.exhibition.panelSettings)
  const { nodes } = useGLTF(getSpaceConfig(spaceId || 'paris').gltfPath) as unknown as {
    nodes: Record<string, Mesh>
  }

  // One matrix per panel, built from the same helper the panel itself uses, so
  // an artwork hung on a panel moves and turns with it instead of being left
  // hanging in the air where the panel used to stand.
  const panelTransforms = useMemo(() => {
    const transforms = new Map<number, Matrix4>()
    for (const key of Object.keys(nodes)) {
      const match = /^panel(\d+)$/.exec(key)
      if (!match) continue
      const index = Number(match[1])
      transforms.set(index, panelMatrix(panelSettings?.[String(index)], panelPivot(nodes[key])))
    }
    return transforms
  }, [nodes, panelSettings])

  const artworksWithPosition: ArtworkWithPosition[] = useMemo(() => {
    // Rank each item within its OWN wall. Only items sharing a wall are
    // coplanar, so ranking globally would interleave walls for no reason.
    const itemsByWall: Record<string, LayerItem[]> = {}
    allArtworkIds.forEach((id) => {
      const artwork = artworksById[id]
      const pos = exhibitionArtworksById[id]
      if (!artwork || !pos) return
      const wall = (itemsByWall[pos.wallId] ??= [])
      wall.push({ id, artworkType: artwork.artworkType, zOrder: pos.zOrder })
    })
    const rankById: Record<string, number> = {}
    Object.values(itemsByWall).forEach((items) => Object.assign(rankById, layerRankById(items)))

    return allArtworkIds
      .map((id) => {
        const artwork = artworksById[id]
        const pos = exhibitionArtworksById[id]
        if (!artwork || !pos) return null

        // Hung on a panel that is switched off: the panel is gone from the
        // room, so its artworks go with it. Left in, they would hang in mid-air
        // where the panel used to be.
        const panelIndex = panelIndexOfFace(pos.wallId)
        if (panelIndex !== null && !isPanelEnabled(panelSettings?.[String(panelIndex)])) {
          return null
        }

        const position = new Vector3(pos.posX3d, pos.posY3d, pos.posZ3d)
        const quaternion = new Quaternion(
          pos.quaternionX,
          pos.quaternionY,
          pos.quaternionZ,
          pos.quaternionW,
        )

        // Ride the panel: position through the full matrix, orientation through
        // its rotation alone. Applied BEFORE the depth offset below, which
        // works off the final facing direction.
        const transform = panelIndex === null ? undefined : panelTransforms.get(panelIndex)
        if (transform) {
          position.applyMatrix4(transform)
          quaternion.premultiply(new Quaternion().setFromRotationMatrix(transform))
        }

        // Lift the item off the wall by its rank so the 3D depth matches the
        // 2D stacking instead of z-fighting against whatever shares its plane.
        // The quaternion maps local +z onto the wall normal.
        position.addScaledVector(
          new Vector3(0, 0, 1).applyQuaternion(quaternion),
          (rankById[id] ?? 0) * LAYER_DEPTH_STEP,
        )

        return {
          ...artwork,
          position,
          quaternion,
          width: pos.width3d || 1,
          height: pos.height3d || 1,
        }
      })
      .filter((a): a is ArtworkWithPosition => a !== null)
  }, [allArtworkIds, artworksById, exhibitionArtworksById, panelSettings, panelTransforms])

  return (
    <>
      {artworksWithPosition.map((artwork) => (
        <ArtObject key={artwork.id} artwork={artwork} />
      ))}
    </>
  )
}

export default ArtObjects
