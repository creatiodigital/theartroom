'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useGLTF } from '@react-three/drei'
import { Mesh } from 'three'

import { getSpaceConfig, type SpaceKey } from '@/components/scene/constants'
import { SelectField } from '@/components/wallview/chrome'
import { useBoundingData } from '@/components/wallview/hooks/useBoundingData'
import { pushToHistory } from '@/redux/slices/exhibitionSlice'
import type { RootState, AppDispatch } from '@/redux/store'

import {
  applyPresetToArtwork,
  type TPreset,
  type PresetType,
} from '../PresetSection/applyPresetToArtwork'
import styles from '../PresetSection/PresetSection.module.scss'
import { spaceGltfUrl } from '@/components/scene/spaceAsset'

type GroupPresetApplyProps = {
  artworkIds: string[]
  uniformType: PresetType
}

const GroupPresetApply = ({ artworkIds, uniformType }: GroupPresetApplyProps) => {
  const dispatch = useDispatch<AppDispatch>()
  const [presets, setPresets] = useState<TPreset[]>([])

  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )

  // Get bounding data for convert2DTo3D
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId) as SpaceKey | null
  const gltfPath = spaceGltfUrl(getSpaceConfig(spaceId || 'paris').gltfPath)
  const { nodes } = useGLTF(gltfPath) as unknown as { nodes: Record<string, Mesh> }
  const currentWallId = useSelector((state: RootState) => state.wallView.currentWallId)
  const boundingData = useBoundingData(nodes as Record<string, Mesh>, currentWallId)

  // Fetch presets from API, filtered by the uniform type
  const fetchPresets = useCallback(async () => {
    try {
      const response = await fetch('/api/presets')
      if (response.ok) {
        const data = await response.json()
        setPresets(data.filter((p: TPreset) => p.presetType === uniformType))
      }
    } catch (error) {
      console.error('Failed to fetch presets:', error)
    }
  }, [uniformType])

  useEffect(() => {
    fetchPresets()
  }, [fetchPresets])

  // Apply preset to ALL grouped artworks
  const handleApplyToAll = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId)
    if (!preset) return

    // Push history once before the batch
    dispatch(pushToHistory())

    // Apply to each artwork in the group
    artworkIds.forEach((artworkId) => {
      applyPresetToArtwork(
        dispatch,
        preset,
        artworkId,
        uniformType,
        exhibitionArtworksById,
        boundingData,
      )
    })
  }

  const presetOptions = presets.map((p) => ({ label: p.name, value: p.id }))

  return (
    // The caption ("Preset for all") is the parent group's.
    <div className={styles.presetSection}>
      <SelectField<string>
        label="Preset for all"
        hideLabel
        options={
          presets.length > 0
            ? [{ label: 'Apply a preset to all…', value: '' }, ...presetOptions]
            : [{ label: 'No presets yet', value: '' }]
        }
        value=""
        onChange={(val) => {
          if (val && presets.length > 0) handleApplyToAll(val)
        }}
        disabled={presets.length === 0}
      />
    </div>
  )
}

export default GroupPresetApply
