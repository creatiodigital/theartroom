'use client'

import { useDispatch, useSelector } from 'react-redux'

import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import { showLightingPanel, hideLightingPanel, showFloorPanel, hideFloorPanel } from '@/redux/slices/dashboardSlice'
import { hidePlaceholders, showPlaceholders } from '@/redux/slices/sceneSlice'
import { resetWallView } from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'

import styles from './Menu.module.scss'

export const Menu = () => {
  const dispatch = useDispatch()

  const isPlaceholdersShown = useSelector((state: RootState) => state.scene.isPlaceholdersShown)
  const isLightingPanelOpen = useSelector((state: RootState) => state.dashboard.isLightingPanelOpen)
  const isFloorPanelOpen = useSelector((state: RootState) => state.dashboard.isFloorPanelOpen)

  const togglePlaceholders = () => {
    if (isPlaceholdersShown) {
      dispatch(hidePlaceholders())
    } else {
      dispatch(showPlaceholders())
    }
  }

  const toggleLightingPanel = () => {
    if (isLightingPanelOpen) {
      dispatch(hideLightingPanel())
    } else {
      // Close other panels first
      if (isFloorPanelOpen) dispatch(hideFloorPanel())
      dispatch(showLightingPanel())
    }
  }

  const toggleFloorPanel = () => {
    if (isFloorPanelOpen) {
      dispatch(hideFloorPanel())
    } else {
      // Close other panels first
      if (isLightingPanelOpen) dispatch(hideLightingPanel())
      dispatch(showFloorPanel())
    }
  }

  const handleClose = () => {
    // Reset wallView state to prevent stale data when switching exhibitions
    dispatch(resetWallView())
    // Navigate to dashboard
    window.location.href = '/dashboard'
  }

  return (
    <div className={styles.menu}>
      <Tooltip label="Back to Dashboard" placement="right">
        <Button size="regular" variant="secondary" icon="close" onClick={handleClose} />
      </Tooltip>
      <Tooltip label={isPlaceholdersShown ? 'Hide Placeholders' : 'Show Placeholders'} placement="right">
        <Button 
          size="regular" 
          variant="secondary"
          icon={isPlaceholdersShown ? 'preview' : 'placeholder'}
          onClick={() => togglePlaceholders()}
        />
      </Tooltip>
      <Tooltip label="Lighting controls" placement="right">
        <Button size="regular" variant="secondary" icon="light" onClick={toggleLightingPanel} />
      </Tooltip>
      <Tooltip label="Floor controls" placement="right">
        <Button size="regular" variant="secondary" icon="brick-wall" onClick={toggleFloorPanel} />
      </Tooltip>
    </div>
  )
}

export default Menu
