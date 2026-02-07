'use client'

import { useDispatch, useSelector } from 'react-redux'

import { SettingsPanel } from '@/components/editview/SettingsPanel'
import { hideHumanPanel } from '@/redux/slices/dashboardSlice'
import { showHuman, hideHuman, setHumanPositionX, setHumanPositionZ, setHumanRotationY } from '@/redux/slices/sceneSlice'
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
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={isHumanVisible}
              onChange={handleToggle}
            />
            <span className={styles.toggleSlider} />
          </label>
        </div>
        <span className={styles.heightLabel}>Height: 1.70 m</span>
      </div>

      <div className={styles.section}>
        <div className={styles.field}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>X Position</label>
            <span className={styles.sliderValue}>{humanPositionX.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="-12"
            max="12"
            step="0.1"
            value={humanPositionX}
            onChange={(e) => dispatch(setHumanPositionX(parseFloat(e.target.value)))}
            className={styles.slider}
          />
        </div>

        <div className={styles.field}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>Z Position</label>
            <span className={styles.sliderValue}>{humanPositionZ.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="-12"
            max="12"
            step="0.1"
            value={humanPositionZ}
            onChange={(e) => dispatch(setHumanPositionZ(parseFloat(e.target.value)))}
            className={styles.slider}
          />
        </div>

        <div className={styles.field}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>Rotation</label>
            <span className={styles.sliderValue}>{humanRotationY.toFixed(0)}°</span>
          </div>
          <input
            type="range"
            min="0"
            max="360"
            step="1"
            value={humanRotationY}
            onChange={(e) => dispatch(setHumanRotationY(parseFloat(e.target.value)))}
            className={styles.slider}
          />
        </div>
      </div>
    </SettingsPanel>
  )
}

export default HumanPanel
