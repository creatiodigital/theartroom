'use client'

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
  showHumanPanel,
  hideHumanPanel,
  showFurniturePanel,
  hideFurniturePanel,
} from '@/redux/slices/dashboardSlice'
import { hidePlaceholders, showPlaceholders } from '@/redux/slices/sceneSlice'
import { resetWallView } from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'

import styles from './Menu.module.scss'

export const Menu = () => {
  const dispatch = useDispatch()

  const isPlaceholdersShown = useSelector((state: RootState) => state.scene.isPlaceholdersShown)
  const isLightingPanelOpen = useSelector((state: RootState) => state.dashboard.isLightingPanelOpen)
  const isFloorPanelOpen = useSelector((state: RootState) => state.dashboard.isFloorPanelOpen)
  const isCameraPanelOpen = useSelector((state: RootState) => state.dashboard.isCameraPanelOpen)
  const isHumanPanelOpen = useSelector((state: RootState) => state.dashboard.isHumanPanelOpen)
  const isFurniturePanelOpen = useSelector(
    (state: RootState) => state.dashboard.isFurniturePanelOpen,
  )

  const togglePlaceholders = () => {
    if (isPlaceholdersShown) {
      dispatch(hidePlaceholders())
    } else {
      dispatch(showPlaceholders())
    }
  }

  const toggleHumanPanel = () => {
    if (isHumanPanelOpen) {
      dispatch(hideHumanPanel())
    } else {
      // Close other panels first
      if (isLightingPanelOpen) dispatch(hideLightingPanel())
      if (isFloorPanelOpen) dispatch(hideFloorPanel())
      if (isCameraPanelOpen) dispatch(hideCameraPanel())
      if (isFurniturePanelOpen) dispatch(hideFurniturePanel())
      dispatch(showHumanPanel())
    }
  }

  // @ts-ignore - temporarily unused while furniture button is hidden
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const toggleFurniturePanel = () => {
    if (isFurniturePanelOpen) {
      dispatch(hideFurniturePanel())
    } else {
      // Close other panels first
      if (isLightingPanelOpen) dispatch(hideLightingPanel())
      if (isFloorPanelOpen) dispatch(hideFloorPanel())
      if (isCameraPanelOpen) dispatch(hideCameraPanel())
      if (isHumanPanelOpen) dispatch(hideHumanPanel())
      dispatch(showFurniturePanel())
    }
  }

  const toggleLightingPanel = () => {
    if (isLightingPanelOpen) {
      dispatch(hideLightingPanel())
    } else {
      // Close other panels first
      if (isFloorPanelOpen) dispatch(hideFloorPanel())
      if (isCameraPanelOpen) dispatch(hideCameraPanel())
      if (isHumanPanelOpen) dispatch(hideHumanPanel())
      if (isFurniturePanelOpen) dispatch(hideFurniturePanel())
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
      if (isHumanPanelOpen) dispatch(hideHumanPanel())
      if (isFurniturePanelOpen) dispatch(hideFurniturePanel())
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
      if (isHumanPanelOpen) dispatch(hideHumanPanel())
      if (isFurniturePanelOpen) dispatch(hideFurniturePanel())
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
    <div className={styles.menu}>
      <Tooltip label="Back to Dashboard" placement="right">
        <Button size="regular" variant="secondary" icon="close" onClick={handleClose} />
      </Tooltip>
      <Tooltip
        label={isPlaceholdersShown ? 'Hide Wall Placeholders' : 'Show WallPlaceholders'}
        placement="right"
      >
        <Button
          size="regular"
          variant="secondary"
          icon={isPlaceholdersShown ? 'preview' : 'placeholder'}
          onClick={() => togglePlaceholders()}
        />
      </Tooltip>
      <Tooltip label="Human reference" placement="right">
        <Button
          size="regular"
          variant="secondary"
          icon="human-standing"
          onClick={toggleHumanPanel}
        />
      </Tooltip>
      <Tooltip label="Lighting controls" placement="right">
        <Button size="regular" variant="secondary" icon="light" onClick={toggleLightingPanel} />
      </Tooltip>
      {/* Furniture button - hidden until a suitable bench model is found
      <Tooltip label="Furniture" placement="right">
        <Button size="regular" variant="secondary" icon="armchair" onClick={toggleFurniturePanel} />
      </Tooltip>
      */}
      <Tooltip label="Floor controls" placement="right">
        <Button size="regular" variant="secondary" icon="brick-wall" onClick={toggleFloorPanel} />
      </Tooltip>
      <Tooltip label="Camera controls" placement="right">
        <Button size="regular" variant="secondary" icon="camera" onClick={toggleCameraPanel} />
      </Tooltip>
    </div>
  )
}

export default Menu
