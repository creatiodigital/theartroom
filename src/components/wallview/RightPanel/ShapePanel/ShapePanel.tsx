'use client'

import { useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { ColorPicker } from '@/components/ui/ColorPicker'
import { Section } from '@/components/ui/Section/Section'
import { Select } from '@/components/ui/Select'
import { Text } from '@/components/ui/Typography'
import { editArtwork } from '@/redux/slices/artworkSlice'
import { pushToHistory } from '@/redux/slices/exhibitionSlice'
import type { RootState } from '@/redux/store'
import type { TArtwork } from '@/types/artwork'
import PresetSection from '../PresetSection/PresetSection'

import styles from '../RightPanel.module.scss'

const shapeTypes = [
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'circle', label: 'Circle' },
]

const ShapePanel = ({ disabled }: { disabled?: boolean }) => {
  const dispatch = useDispatch()
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)
  const artwork = useSelector((state: RootState) =>
    currentArtworkId ? state.artworks.byId[currentArtworkId] : null,
  )

  const handleChange = useCallback(
    <K extends keyof TArtwork>(property: K, value: TArtwork[K]) => {
      if (!currentArtworkId) return
      dispatch(pushToHistory())
      dispatch(editArtwork({ currentArtworkId, property, value }))
    },
    [currentArtworkId, dispatch],
  )

  if (!artwork) return null

  const shapeType = artwork.shapeType ?? 'rectangle'
  const shapeColor = artwork.shapeColor ?? '#000000'
  const shapeOpacity = artwork.shapeOpacity ?? 1

  return (
    <>
      <Section title="Properties" disabled={disabled}>
        <div className={styles.row}>
          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>
              Shape Type
            </Text>
            <Select<string>
              options={shapeTypes}
              value={shapeType}
              onChange={(val) => handleChange('shapeType', val)}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>
              Color
            </Text>
            <ColorPicker
              textColor={shapeColor}
              onColorSelect={(color) => handleChange('shapeColor', color)}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.item}>
            <div className={styles.sliderHeader}>
              <Text font="dashboard" as="span" size="xs" className={styles.label}>
                Opacity
              </Text>
              <span className={styles.sliderValue}>{Math.round(shapeOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={shapeOpacity}
              onChange={(e) => handleChange('shapeOpacity', parseFloat(e.target.value))}
              className={styles.slider}
            />
          </div>
        </div>
      </Section>

      <Section title="Presets" disabled={disabled}>
        <PresetSection presetType="shape" />
      </Section>
    </>
  )
}

export { ShapePanel }
export default ShapePanel
