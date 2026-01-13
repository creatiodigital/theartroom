'use client'

import { useDispatch, useSelector } from 'react-redux'

import { Button } from '@/components/ui/Button'
import { showLightingPanel, hideLightingPanel } from '@/redux/slices/dashboardSlice'
import { hidePlaceholders, showPlaceholders } from '@/redux/slices/sceneSlice'
import { resetWallView } from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'

import styles from './Menu.module.scss'

export const Menu = () => {
  const dispatch = useDispatch()

  const isPlaceholdersShown = useSelector((state: RootState) => state.scene.isPlaceholdersShown)
  const isLightingPanelOpen = useSelector((state: RootState) => state.dashboard.isLightingPanelOpen)

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
      dispatch(showLightingPanel())
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
      <Button size="small" icon="close" title="Go to main dashboard" onClick={handleClose} />
      <Button size="small"
        icon={isPlaceholdersShown ? 'preview' : 'placeholder'}
        title="Show/Hide wall placeholders"
        onClick={() => togglePlaceholders()}
      />
      <Button size="small" icon="light" title="Global Light controls" onClick={toggleLightingPanel} />
    </div>
  )
}

export default Menu
