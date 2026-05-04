'use client'

import { useDispatch, useSelector } from 'react-redux'

import { Slider } from '@/components/ui/Slider'
import { Toggle } from '@/components/ui/Toggle'
import { SettingsPanel } from '@/components/editview/SettingsPanel'
import { hideHumanPanel } from '@/redux/slices/dashboardSlice'
import {
  showHuman,
  hideHuman,
  setHumanPositionX,
  setHumanPositionZ,
  setHumanRotationY,
} from '@/redux/slices/sceneSlice'
import type { RootState } from '@/redux/store'

import styles from './HumanPanel.module.scss'

const HumanPanel = () => {
  const dispatch = useDispatch()

  const isHumanVisible = useSelector((state: RootState) => state.scene.isHumanVisible)
  const humanPositionX = useSelector((state: RootState) => state.scene.humanPositionX)
  const humanPositionZ = useSelector((state: RootState) => state.scene.humanPositionZ)
  const humanRotationY = useSelector((state: RootState) => state.scene.humanRotationY)

  const handleClose = () => {
    dispatch(hideHumanPanel())
  }

  const handleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      dispatch(showHuman())
    } else {
      dispatch(hideHuman())
    }
  }

  return (
    <SettingsPanel title="Human Reference" onClose={handleClose}>
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Show Human</span>
          <Toggle
            checked={isHumanVisible}
            onChange={handleToggle}
            aria-label="Show human reference"
          />
        </div>
        <span className={styles.heightLabel}>Height: 1.70 m</span>
      </div>

      <div className={styles.section}>
        <div className={styles.field}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>X Position</label>
            <span className={styles.sliderValue}>{humanPositionX.toFixed(1)}</span>
          </div>
          <Slider
            min={-12}
            max={12}
            step={0.1}
            value={humanPositionX}
            onChange={(v) => dispatch(setHumanPositionX(v))}
            aria-label="Human position X"
          />
        </div>

        <div className={styles.field}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>Z Position</label>
            <span className={styles.sliderValue}>{humanPositionZ.toFixed(1)}</span>
          </div>
          <Slider
            min={-12}
            max={12}
            step={0.1}
            value={humanPositionZ}
            onChange={(v) => dispatch(setHumanPositionZ(v))}
            aria-label="Human position Z"
          />
        </div>

        <div className={styles.field}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>Rotation</label>
            <span className={styles.sliderValue}>{humanRotationY.toFixed(0)}°</span>
          </div>
          <Slider
            min={0}
            max={360}
            step={1}
            value={humanRotationY}
            onChange={(v) => dispatch(setHumanRotationY(v))}
            aria-label="Human rotation"
          />
        </div>
      </div>
    </SettingsPanel>
  )
}

export default HumanPanel
