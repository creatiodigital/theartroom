'use client'

import { useContext, useMemo, createRef } from 'react'
import { useSelector } from 'react-redux'
import type { Mesh } from 'three'

import SceneContext from '@/contexts/SceneContext'
import type { RootState } from '@/redux/store'
import type { TArtwork } from '@/types/artwork'

import { spaceComponents, getSpaceConfig, type SpaceKey } from './constants'

type SpaceProps = {
  onPlaceholderClick: (wallId: string) => void
  artworks: TArtwork[]
}

export const Space: React.FC<SpaceProps> = ({ onPlaceholderClick, artworks }) => {
  const sceneContext = useContext(SceneContext)
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId) || 'classic'

  const spaceKey = spaceId as SpaceKey
  const spaceConfig = getSpaceConfig(spaceId)

  const wallRefArray = useMemo(
    () => Array.from({ length: spaceConfig.refs.walls || 0 }, () => createRef<Mesh>()),
    [spaceConfig.refs.walls],
  )

  const windowRefArray = useMemo(
    () => Array.from({ length: spaceConfig.refs.windows || 0 }, () => createRef<Mesh>()),
    [spaceConfig.refs.windows],
  )

  const glassRefArray = useMemo(
    () => Array.from({ length: spaceConfig.refs.glass || 0 }, () => createRef<Mesh>()),
    [spaceConfig.refs.glass],
  )

  if (!sceneContext || !spaceId) return null

  const { wallRefs, windowRefs, glassRefs } = sceneContext

  if (spaceConfig.refs.walls) wallRefs.current = wallRefArray
  if (spaceConfig.refs.windows) windowRefs.current = windowRefArray
  if (spaceConfig.refs.glass) glassRefs.current = glassRefArray

  const SpaceComponent = spaceComponents[spaceKey] || spaceComponents['classic']
  if (!SpaceComponent) return null

  return (
    <SpaceComponent
      onPlaceholderClick={onPlaceholderClick}
      artworks={artworks}
      wallRefs={wallRefs.current}
      windowRefs={windowRefs.current}
      glassRefs={glassRefs.current}
    />
  )
}
