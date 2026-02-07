'use client'

import { useRef, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import { 
  showLightingPanel, 
  hideLightingPanel, 
  showFloorPanel, 
  hideFloorPanel,
  showCameraPanel,
  hideCameraPanel,
} from '@/redux/slices/dashboardSlice'
import { setMainTitle } from '@/redux/slices/exhibitionSlice'
import { hidePlaceholders, showPlaceholders, showHuman, hideHuman } from '@/redux/slices/sceneSlice'
import { resetWallView } from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'

import styles from './Menu.module.scss'

export const Menu = () => {
  const dispatch = useDispatch()
  const nameRef = useRef<HTMLSpanElement>(null)

  const exhibitionId = useSelector((state: RootState) => state.exhibition.id)
  const mainTitle = useSelector((state: RootState) => state.exhibition.mainTitle ?? '')
  const isPlaceholdersShown = useSelector((state: RootState) => state.scene.isPlaceholdersShown)
  const isHumanVisible = useSelector((state: RootState) => state.scene.isHumanVisible)
  const isLightingPanelOpen = useSelector((state: RootState) => state.dashboard.isLightingPanelOpen)
  const isFloorPanelOpen = useSelector((state: RootState) => state.dashboard.isFloorPanelOpen)
  const isCameraPanelOpen = useSelector((state: RootState) => state.dashboard.isCameraPanelOpen)

  const handleNameBlur = useCallback(async () => {
    const newName = nameRef.current?.textContent?.trim() || ''
    if (!newName || newName === mainTitle || !exhibitionId) return
    dispatch(setMainTitle(newName))
    try {
      await fetch(`/api/exhibitions/${exhibitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mainTitle: newName }),
      })
    } catch (err) {
      console.error('Failed to save exhibition name:', err)
    }
  }, [mainTitle, exhibitionId, dispatch])

  const handleNameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      nameRef.current?.blur()
    }
  }, [])

  const togglePlaceholders = () => {
    if (isPlaceholdersShown) {
      dispatch(hidePlaceholders())
    } else {
      dispatch(showPlaceholders())
    }
  }

  const toggleHuman = () => {
    if (isHumanVisible) {
      dispatch(hideHuman())
    } else {
      dispatch(showHuman())
    }
  }

  const toggleLightingPanel = () => {
    if (isLightingPanelOpen) {
      dispatch(hideLightingPanel())
    } else {
      // Close other panels first
      if (isFloorPanelOpen) dispatch(hideFloorPanel())
      if (isCameraPanelOpen) dispatch(hideCameraPanel())
      dispatch(showLightingPanel())
    }
  }

  const toggleFloorPanel = () => {
    if (isFloorPanelOpen) {
      dispatch(hideFloorPanel())
    } else {
      // Close other panels first
      if (isLightingPanelOpen) dispatch(hideLightingPanel())
      if (isCameraPanelOpen) dispatch(hideCameraPanel())
      dispatch(showFloorPanel())
    }
  }

  const toggleCameraPanel = () => {
    if (isCameraPanelOpen) {
      dispatch(hideCameraPanel())
    } else {
      // Close other panels first
      if (isLightingPanelOpen) dispatch(hideLightingPanel())
      if (isFloorPanelOpen) dispatch(hideFloorPanel())
      dispatch(showCameraPanel())
    }
  }

  const handleClose = () => {
    // Reset wallView state to prevent stale data when switching exhibitions
    dispatch(resetWallView())
    // Navigate to dashboard
    window.location.href = '/dashboard'
  }

  return (
    <>
    <div className={styles.nameBar}>
      <span
        ref={nameRef}
        className={styles.editableName}
        contentEditable
        suppressContentEditableWarning
        onBlur={handleNameBlur}
        onKeyDown={handleNameKeyDown}
        spellCheck={false}
      >
        {mainTitle}
      </span>
    </div>
    <div className={styles.menu}>
      <Tooltip label="Back to Dashboard" placement="right">
        <Button size="regular" variant="secondary" icon="close" onClick={handleClose} />
      </Tooltip>
      <Tooltip label={isPlaceholdersShown ? 'Hide Wall Placeholders' : 'Show WallPlaceholders'} placement="right">
        <Button 
          size="regular" 
          variant="secondary"
          icon={isPlaceholdersShown ? 'preview' : 'placeholder'}
          onClick={() => togglePlaceholders()}
        />
      </Tooltip>
      <Tooltip label={isHumanVisible ? 'Hide Human Reference' : 'Show Human Reference'} placement="right">
        <Button 
          size="regular" 
          variant="secondary"
          icon="human-standing"
          onClick={() => toggleHuman()}
        />
      </Tooltip>
      <Tooltip label="Lighting controls" placement="right">
        <Button size="regular" variant="secondary" icon="light" onClick={toggleLightingPanel} />
      </Tooltip>
      <Tooltip label="Floor controls" placement="right">
        <Button size="regular" variant="secondary" icon="brick-wall" onClick={toggleFloorPanel} />
      </Tooltip>
      <Tooltip label="Camera controls" placement="right">
        <Button size="regular" variant="secondary" icon="camera" onClick={toggleCameraPanel} />
      </Tooltip>
    </div>
    </>
  )
}

export default Menu
