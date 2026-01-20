'use client'

import { useDispatch, useSelector } from 'react-redux'

import { Text } from '@/components/ui/Typography'
import { SettingsPanel } from '@/components/editview/SettingsPanel'
import { hideFloorPanel } from '@/redux/slices/dashboardSlice'
import { setFloorReflectiveness } from '@/redux/slices/exhibitionSlice'
import type { RootState } from '@/redux/store'

import styles from './FloorPanel.module.scss'

const DEFAULT_FLOOR_REFLECTIVENESS = 0.3

const FloorPanel = () => {
  const dispatch = useDispatch()

  const floorReflectiveness = useSelector(
    (state: RootState) => state.exhibition.floorReflectiveness ?? DEFAULT_FLOOR_REFLECTIVENESS,
  )

  const handleReflectivenessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setFloorReflectiveness(parseFloat(e.target.value)))
  }

  const handleClose = () => {
    dispatch(hideFloorPanel())
  }

  return (
    <SettingsPanel title="Floor" onClose={handleClose}>
      <div className={styles.section}>
        <Text as="h3" size="sm" weight="medium" className={styles.sectionTitle}>
          Surface
        </Text>
        
        <div className={styles.field}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>Reflectiveness</label>
            <span className={styles.sliderValue}>{floorReflectiveness.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={floorReflectiveness}
            onChange={handleReflectivenessChange}
            className={styles.slider}
          />
          <div className={styles.sliderLabels}>
            <span>Matte</span>
            <span>Mirror</span>
          </div>
        </div>
      </div>
    </SettingsPanel>
  )
}

export default FloorPanel
