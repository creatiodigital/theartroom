'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useGLTF } from '@react-three/drei'
import { Mesh } from 'three'

import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Text } from '@/components/ui/Typography'
import { spaceConfigs, type SpaceKey } from '@/components/scene/constants'
import { useBoundingData } from '@/components/wallview/hooks/useBoundingData'
import { convert2DTo3D } from '@/components/wallview/utils'
import { editArtisticImage, editArtisticText } from '@/redux/slices/artworkSlice'
import { updateArtworkPosition, pushToHistory } from '@/redux/slices/exhibitionSlice'
import type { RootState } from '@/redux/store'
import type { TArtwork } from '@/types/artwork'

import DeletePresetsModal from './DeletePresetsModal'
import SavePresetModal from './SavePresetModal'
import UpdatePresetModal from './UpdatePresetModal'
import styles from './PresetSection.module.scss'

type PresetType = 'image' | 'text'

type TPreset = {
  id: string
  name: string
  presetType: string
  width2d: number
  height2d: number
  showFrame: boolean
  frameColor: string
  frameSize: number
  frameThickness: number
  showPassepartout: boolean
  passepartoutColor: string
  passepartoutSize: number
  passepartoutThickness: number
  showSupport: boolean
  supportThickness: number
  supportColor: string
  hideShadow: boolean
  fontFamily: string
  fontSize: number
  fontWeight: string
  letterSpacing: number
  lineHeight: number
  textColor: string
  textBackgroundColor: string | null
  textAlign: string
  textVerticalAlign: string
  textPadding: number
  textThickness: number
}

type PresetSectionProps = {
  presetType: PresetType
}

const PresetSection = ({ presetType }: PresetSectionProps) => {
  const dispatch = useDispatch()
  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [presets, setPresets] = useState<TPreset[]>([])
  const [loading, setLoading] = useState(false)

  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)
  const artworksById = useSelector((state: RootState) => state.artworks.byId)
  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )

  // Get bounding data for convert2DTo3D
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId) as SpaceKey | null
  const gltfPath = spaceConfigs[spaceId || 'classic']?.gltfPath || '/assets/spaces/classic.glb'
  const { nodes } = useGLTF(gltfPath) as unknown as { nodes: Record<string, Mesh> }
  const currentWallId = useSelector((state: RootState) => state.wallView.currentWallId)
  const boundingData = useBoundingData(nodes as Record<string, Mesh>, currentWallId)

  const artwork = currentArtworkId ? artworksById[currentArtworkId] : null
  const exhibitionArtwork = currentArtworkId ? exhibitionArtworksById[currentArtworkId] : null

  // Fetch presets from API
  const fetchPresets = useCallback(async () => {
    try {
      const response = await fetch('/api/presets')
      if (response.ok) {
        const data = await response.json()
        setPresets(data.filter((p: TPreset) => p.presetType === presetType))
      }
    } catch (error) {
      console.error('Failed to fetch presets:', error)
    }
  }, [presetType])

  useEffect(() => {
    fetchPresets()
  }, [fetchPresets])

  // Collect current artwork properties for saving
  const collectCurrentProperties = (): Record<string, unknown> | null => {
    if (!artwork || !exhibitionArtwork) return null

    const props: Record<string, unknown> = {
      presetType,
      // Dimensions from exhibition artwork (2D position data)
      width2d: exhibitionArtwork.width2d,
      height2d: exhibitionArtwork.height2d,
      // Frame — extract raw values from TOption objects
      showFrame: artwork.showFrame ?? false,
      frameColor: artwork.frameColor ?? '#000000',
      frameSize:
        typeof artwork.frameSize === 'object'
          ? (artwork.frameSize?.value ?? 5)
          : (artwork.frameSize ?? 5),
      frameThickness:
        typeof artwork.frameThickness === 'object'
          ? (artwork.frameThickness?.value ?? 0.5)
          : (artwork.frameThickness ?? 0.5),
      // Passepartout
      showPassepartout: artwork.showPassepartout ?? false,
      passepartoutColor: artwork.passepartoutColor ?? '#ffffff',
      passepartoutSize:
        typeof artwork.passepartoutSize === 'object'
          ? (artwork.passepartoutSize?.value ?? 10)
          : (artwork.passepartoutSize ?? 10),
      passepartoutThickness:
        typeof artwork.passepartoutThickness === 'object'
          ? (artwork.passepartoutThickness?.value ?? 0.3)
          : (artwork.passepartoutThickness ?? 0.3),
      // Support
      showSupport: artwork.showSupport ?? false,
      supportThickness:
        typeof artwork.supportThickness === 'object'
          ? (artwork.supportThickness?.value ?? 2.0)
          : (artwork.supportThickness ?? 2.0),
      supportColor: artwork.supportColor ?? '#ffffff',
      // Shadow
      hideShadow: artwork.hideShadow ?? false,
    }

    // Text properties (only for text presets)
    if (presetType === 'text') {
      props.fontFamily =
        typeof artwork.fontFamily === 'object'
          ? (artwork.fontFamily?.value ?? 'Montserrat')
          : (artwork.fontFamily ?? 'Montserrat')
      props.fontSize =
        typeof artwork.fontSize === 'object'
          ? (artwork.fontSize?.value ?? 16)
          : (artwork.fontSize ?? 16)
      props.fontWeight =
        typeof artwork.fontWeight === 'object'
          ? (artwork.fontWeight?.value ?? '400')
          : (artwork.fontWeight ?? '400')
      props.letterSpacing =
        typeof artwork.letterSpacing === 'object'
          ? (artwork.letterSpacing?.value ?? 0)
          : (artwork.letterSpacing ?? 0)
      props.lineHeight =
        typeof artwork.lineHeight === 'object'
          ? (artwork.lineHeight?.value ?? 1.4)
          : (artwork.lineHeight ?? 1.4)
      props.textColor = artwork.textColor ?? '#000000'
      props.textBackgroundColor = artwork.textBackgroundColor ?? null
      props.textAlign = artwork.textAlign ?? 'left'
      props.textVerticalAlign = artwork.textVerticalAlign ?? 'top'
      props.textPadding =
        typeof artwork.textPadding === 'object'
          ? (artwork.textPadding?.value ?? 12)
          : (artwork.textPadding ?? 12)
      props.textThickness =
        typeof artwork.textThickness === 'object'
          ? (artwork.textThickness?.value ?? 0)
          : (artwork.textThickness ?? 0)
    }

    return props
  }

  // Save preset
  const handleSavePreset = async (name: string) => {
    const properties = collectCurrentProperties()
    if (!properties) return

    setLoading(true)
    try {
      const response = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, ...properties }),
      })

      if (response.ok) {
        await fetchPresets()
        setShowModal(false)
      }
    } catch (error) {
      console.error('Failed to save preset:', error)
    } finally {
      setLoading(false)
    }
  }

  // Apply preset to current artwork
  const handleApplyPreset = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId)
    if (!preset || !currentArtworkId) return

    dispatch(pushToHistory())

    // Apply dimensions via exhibitionSlice, recomputing full 3D transform
    const currentPos = exhibitionArtworksById[currentArtworkId]
    if (currentPos && boundingData) {
      const new3D = convert2DTo3D(
        currentPos.posX2d,
        currentPos.posY2d,
        preset.width2d,
        preset.height2d,
        boundingData,
      )
      dispatch(
        updateArtworkPosition({
          artworkId: currentArtworkId,
          artworkPosition: {
            width2d: preset.width2d,
            height2d: preset.height2d,
            ...new3D,
          },
        }),
      )
    } else {
      // Fallback: just update 2D dims (auto-derives width3d/height3d)
      dispatch(
        updateArtworkPosition({
          artworkId: currentArtworkId,
          artworkPosition: {
            width2d: preset.width2d,
            height2d: preset.height2d,
          },
        }),
      )
    }

    // Apply display properties via artworkSlice
    const editAction = presetType === 'text' ? editArtisticText : editArtisticImage
    const applyProp = <K extends keyof TArtwork>(property: K, value: TArtwork[K]) => {
      dispatch(editAction({ currentArtworkId, property, value }))
    }

    // Frame
    applyProp('showFrame', preset.showFrame)
    applyProp('frameColor', preset.frameColor)
    applyProp('frameSize', { label: String(preset.frameSize), value: preset.frameSize })
    applyProp('frameThickness', {
      label: String(preset.frameThickness),
      value: preset.frameThickness,
    })

    // Passepartout
    applyProp('showPassepartout', preset.showPassepartout)
    applyProp('passepartoutColor', preset.passepartoutColor)
    applyProp('passepartoutSize', {
      label: String(preset.passepartoutSize),
      value: preset.passepartoutSize,
    })
    applyProp('passepartoutThickness', {
      label: String(preset.passepartoutThickness),
      value: preset.passepartoutThickness,
    })

    // Support
    applyProp('showSupport', preset.showSupport)
    applyProp('supportThickness', {
      label: String(preset.supportThickness),
      value: preset.supportThickness,
    })
    applyProp('supportColor', preset.supportColor)

    // Shadow
    applyProp('hideShadow', preset.hideShadow)

    // Text properties (for text presets)
    if (presetType === 'text') {
      applyProp('fontFamily', {
        label: preset.fontFamily,
        value: preset.fontFamily as TArtwork['fontFamily'] extends { value: infer V } ? V : never,
      } as TArtwork['fontFamily'])
      applyProp('fontSize', { label: String(preset.fontSize), value: preset.fontSize })
      applyProp('fontWeight', {
        label: preset.fontWeight,
        value: preset.fontWeight as TArtwork['fontWeight'] extends { value: infer V } ? V : never,
      } as TArtwork['fontWeight'])
      applyProp('letterSpacing', {
        label: String(preset.letterSpacing),
        value: preset.letterSpacing,
      })
      applyProp('lineHeight', { label: String(preset.lineHeight), value: preset.lineHeight })
      applyProp('textColor', preset.textColor)
      applyProp('textBackgroundColor', preset.textBackgroundColor ?? undefined)
      applyProp('textAlign', preset.textAlign as TArtwork['textAlign'])
      applyProp('textVerticalAlign', preset.textVerticalAlign as TArtwork['textVerticalAlign'])
      applyProp('textPadding', { label: String(preset.textPadding), value: preset.textPadding })
      applyProp('textThickness', {
        label: String(preset.textThickness),
        value: preset.textThickness,
      })
    }
  }

  // Update preset
  const handleUpdatePreset = async (presetId: string) => {
    const properties = collectCurrentProperties()
    if (!properties) return

    setLoading(true)
    try {
      const response = await fetch(`/api/presets/${presetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(properties),
      })

      if (response.ok) {
        await fetchPresets()
        setShowUpdateModal(false)
      }
    } catch (error) {
      console.error('Failed to update preset:', error)
    } finally {
      setLoading(false)
    }
  }

  // Delete preset
  const handleDeletePreset = async (presetId: string) => {
    try {
      const response = await fetch(`/api/presets/${presetId}`, { method: 'DELETE' })
      if (response.ok) {
        await fetchPresets()
      }
    } catch (error) {
      console.error('Failed to delete preset:', error)
    }
  }

  // Build select options from presets
  const presetOptions = presets.map((p) => ({ label: p.name, value: p.id }))

  return (
    <>
      <div className={styles.presetSection}>
        <Text font="dashboard" as="h4" size="xs" className={styles.subtitle}>
          Presets
        </Text>
        <div className={styles.row}>
          <div className={styles.item}>
            <Button
              font="dashboard"
              size="small"
              variant="secondary"
              label="Add"
              onClick={() => setShowModal(true)}
              fullWidth
            />
          </div>
          <div className={styles.item}>
            <Button
              font="dashboard"
              size="small"
              variant="secondary"
              label="Update"
              onClick={() => setShowUpdateModal(true)}
              disabled={presets.length === 0}
              fullWidth
            />
          </div>
          <div className={styles.item}>
            <Button
              font="dashboard"
              size="small"
              variant="secondary"
              label="Delete"
              onClick={() => setShowDeleteModal(true)}
              disabled={presets.length === 0}
              fullWidth
            />
          </div>
        </div>
        <div className={styles.row}>
          <div
            className={styles.item}
            style={presets.length === 0 ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
          >
            <Text font="dashboard" as="label" size="xs" className={styles.applyLabel}>
              Apply Preset
            </Text>
            <Select<string>
              options={
                presets.length > 0
                  ? [{ label: '– Select –', value: '' }, ...presetOptions]
                  : [{ label: 'No presets yet', value: '' }]
              }
              value=""
              onChange={(val) => {
                if (val && presets.length > 0) handleApplyPreset(val)
              }}
            />
          </div>
        </div>
      </div>

      {showModal && (
        <SavePresetModal
          onSave={handleSavePreset}
          onClose={() => setShowModal(false)}
          loading={loading}
          existingNames={presets.map((p) => p.name)}
        />
      )}

      {showDeleteModal && (
        <DeletePresetsModal
          presets={presets}
          onDelete={async (presetId) => {
            await handleDeletePreset(presetId)
          }}
          onClose={() => setShowDeleteModal(false)}
        />
      )}

      {showUpdateModal && (
        <UpdatePresetModal
          presets={presets}
          onUpdate={handleUpdatePreset}
          onClose={() => setShowUpdateModal(false)}
          loading={loading}
        />
      )}
    </>
  )
}

export default PresetSection
