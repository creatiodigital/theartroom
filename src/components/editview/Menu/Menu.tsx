'use client'

import { useDispatch, useSelector } from 'react-redux'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import { showLightingPanel, hideLightingPanel } from '@/redux/slices/dashboardSlice'
import { hidePlaceholders, showPlaceholders } from '@/redux/slices/sceneSlice'
import { resetWallView } from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'

import styles from './Menu.module.scss'

export const Menu = () => {
  const dispatch = useDispatch()
  const router = useRouter()

  const isPlaceholdersShown = useSelector((state: RootState) => state.scene.isPlaceholdersShown)
  const isLightingPanelOpen = useSelector((state: RootState) => state.dashboard.isLightingPanelOpen)
  const exhibition = useSelector((state: RootState) => state.exhibition)

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

  const handleOpenSettings = () => {
    // Navigate to exhibition settings page
    if (exhibition?.url) {
      router.push(`/dashboard/exhibitions/${exhibition.id}/settings`)
    }
  }

  return (
    <div className={styles.menu}>
      <Button size="tiny" icon="close" title="Go to main dashboard" onClick={handleClose} />
      <Button size="tiny"
        icon={isPlaceholdersShown ? 'preview' : 'placeholder'}
        title="Show/Hide wall placeholders"
        onClick={() => togglePlaceholders()}
      />
      <Button size="tiny" icon="light" title="Global Light controls" onClick={toggleLightingPanel} />
      <Button size="tiny" icon="settings" title="Go to settings page" onClick={handleOpenSettings} />
    </div>
  )
}

export default Menu
