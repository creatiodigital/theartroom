'use client'

import { useDispatch, useSelector } from 'react-redux'
import { useSession } from 'next-auth/react'

import { isBakedSpace } from '@/lib/bake/bakedSpaces'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import { FURNITURE_PANEL_ENABLED } from '@/components/scene/spaces/objects/Bench/benchSettings'
import {
  showLightingPanel,
  hideLightingPanel,
  showPanelsPanel,
  hidePanelsPanel,
  showFurniturePanel,
  hideFurniturePanel,
  showFloorPanel,
  hideFloorPanel,
  showCameraPanel,
  hideCameraPanel,
  showWallCeilingPanel,
  hideWallCeilingPanel,
  showWindowsPanel,
  hideWindowsPanel,
  showBakePanel,
  hideBakePanel,
} from '@/redux/slices/dashboardSlice'
import { hidePlaceholders, showPlaceholders } from '@/redux/slices/sceneSlice'
import { resetWallView } from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'

import styles from './Menu.module.scss'

export const Menu = () => {
  const dispatch = useDispatch()

  const isPlaceholdersShown = useSelector((state: RootState) => state.scene.isPlaceholdersShown)
  const isLightingPanelOpen = useSelector((state: RootState) => state.dashboard.isLightingPanelOpen)
  const isPanelsPanelOpen = useSelector((state: RootState) => state.dashboard.isPanelsPanelOpen)
  const isFurniturePanelOpen = useSelector(
    (state: RootState) => state.dashboard.isFurniturePanelOpen,
  )
  const isFloorPanelOpen = useSelector((state: RootState) => state.dashboard.isFloorPanelOpen)
  const isCameraPanelOpen = useSelector((state: RootState) => state.dashboard.isCameraPanelOpen)

  const isWallCeilingPanelOpen = useSelector(
    (state: RootState) => state.dashboard.isWallCeilingPanelOpen,
  )
  const isWindowsPanelOpen = useSelector((state: RootState) => state.dashboard.isWindowsPanelOpen)
  const isBakePanelOpen = useSelector((state: RootState) => state.dashboard.isBakePanelOpen)
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId)

  // Presentation only: the server decides who may bake or publish.
  const { data: session } = useSession()
  const userType = session?.user?.userType
  const bakedSpace = isBakedSpace(spaceId)
  const showBake = (userType === 'admin' || userType === 'superAdmin') && bakedSpace

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
      if (isCameraPanelOpen) dispatch(hideCameraPanel())

      if (isWallCeilingPanelOpen) dispatch(hideWallCeilingPanel())
      if (isPanelsPanelOpen) dispatch(hidePanelsPanel())
      if (isWindowsPanelOpen) dispatch(hideWindowsPanel())
      if (isBakePanelOpen) dispatch(hideBakePanel())
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

      if (isWallCeilingPanelOpen) dispatch(hideWallCeilingPanel())
      if (isPanelsPanelOpen) dispatch(hidePanelsPanel())
      if (isWindowsPanelOpen) dispatch(hideWindowsPanel())
      if (isBakePanelOpen) dispatch(hideBakePanel())
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

      if (isWallCeilingPanelOpen) dispatch(hideWallCeilingPanel())
      if (isPanelsPanelOpen) dispatch(hidePanelsPanel())
      if (isWindowsPanelOpen) dispatch(hideWindowsPanel())
      if (isBakePanelOpen) dispatch(hideBakePanel())
      if (isFurniturePanelOpen) dispatch(hideFurniturePanel())
      dispatch(showCameraPanel())
    }
  }

  const toggleWallCeilingPanel = () => {
    if (isWallCeilingPanelOpen) {
      dispatch(hideWallCeilingPanel())
    } else {
      if (isLightingPanelOpen) dispatch(hideLightingPanel())
      if (isFloorPanelOpen) dispatch(hideFloorPanel())
      if (isCameraPanelOpen) dispatch(hideCameraPanel())
      if (isPanelsPanelOpen) dispatch(hidePanelsPanel())

      if (isWindowsPanelOpen) dispatch(hideWindowsPanel())
      if (isBakePanelOpen) dispatch(hideBakePanel())
      if (isFurniturePanelOpen) dispatch(hideFurniturePanel())
      dispatch(showWallCeilingPanel())
    }
  }

  const togglePanelsPanel = () => {
    if (isPanelsPanelOpen) {
      dispatch(hidePanelsPanel())
    } else {
      if (isLightingPanelOpen) dispatch(hideLightingPanel())
      if (isFloorPanelOpen) dispatch(hideFloorPanel())
      if (isCameraPanelOpen) dispatch(hideCameraPanel())
      if (isWallCeilingPanelOpen) dispatch(hideWallCeilingPanel())

      if (isWindowsPanelOpen) dispatch(hideWindowsPanel())
      if (isBakePanelOpen) dispatch(hideBakePanel())
      if (isFurniturePanelOpen) dispatch(hideFurniturePanel())
      dispatch(showPanelsPanel())
    }
  }

  const toggleWindowsPanel = () => {
    if (isWindowsPanelOpen) {
      dispatch(hideWindowsPanel())
    } else {
      if (isLightingPanelOpen) dispatch(hideLightingPanel())
      if (isFloorPanelOpen) dispatch(hideFloorPanel())
      if (isCameraPanelOpen) dispatch(hideCameraPanel())
      if (isWallCeilingPanelOpen) dispatch(hideWallCeilingPanel())
      if (isPanelsPanelOpen) dispatch(hidePanelsPanel())

      if (isBakePanelOpen) dispatch(hideBakePanel())
      if (isFurniturePanelOpen) dispatch(hideFurniturePanel())
      dispatch(showWindowsPanel())
    }
  }

  const toggleFurniturePanel = () => {
    if (isFurniturePanelOpen) {
      dispatch(hideFurniturePanel())
    } else {
      if (isLightingPanelOpen) dispatch(hideLightingPanel())
      if (isFloorPanelOpen) dispatch(hideFloorPanel())
      if (isCameraPanelOpen) dispatch(hideCameraPanel())
      if (isWallCeilingPanelOpen) dispatch(hideWallCeilingPanel())
      if (isPanelsPanelOpen) dispatch(hidePanelsPanel())
      if (isWindowsPanelOpen) dispatch(hideWindowsPanel())
      if (isBakePanelOpen) dispatch(hideBakePanel())
      dispatch(showFurniturePanel())
    }
  }

  const toggleBakePanel = () => {
    if (isBakePanelOpen) {
      dispatch(hideBakePanel())
    } else {
      if (isLightingPanelOpen) dispatch(hideLightingPanel())
      if (isFloorPanelOpen) dispatch(hideFloorPanel())
      if (isCameraPanelOpen) dispatch(hideCameraPanel())
      if (isWallCeilingPanelOpen) dispatch(hideWallCeilingPanel())
      if (isPanelsPanelOpen) dispatch(hidePanelsPanel())
      if (isWindowsPanelOpen) dispatch(hideWindowsPanel())
      if (isFurniturePanelOpen) dispatch(hideFurniturePanel())
      dispatch(showBakePanel())
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
      <Tooltip label="Lighting controls" placement="right">
        <Button size="regular" variant="secondary" icon="light" onClick={toggleLightingPanel} />
      </Tooltip>

      <Tooltip label="Display panels" placement="right">
        <Button size="regular" variant="secondary" icon="panel-top" onClick={togglePanelsPanel} />
      </Tooltip>
      {FURNITURE_PANEL_ENABLED && (
        <Tooltip label="Furniture" placement="right">
          <Button
            size="regular"
            variant="secondary"
            icon="armchair"
            onClick={toggleFurniturePanel}
          />
        </Tooltip>
      )}
      <Tooltip label="Walls and Ceiling" placement="right">
        <Button size="regular" variant="secondary" icon="house" onClick={toggleWallCeilingPanel} />
      </Tooltip>
      <Tooltip label="Windows and Radiators" placement="right">
        <Button size="regular" variant="secondary" icon="grid-2x2" onClick={toggleWindowsPanel} />
      </Tooltip>
      {/* AR-161 (spec rule 3): a baked space has one floor — there, the panel sets only the
          boards' size and placement (AR-163). */}
      <Tooltip label="Floor controls" placement="right">
        <Button size="regular" variant="secondary" icon="brick-wall" onClick={toggleFloorPanel} />
      </Tooltip>
      <Tooltip label="Camera controls" placement="right">
        <Button size="regular" variant="secondary" icon="camera" onClick={toggleCameraPanel} />
      </Tooltip>
      {showBake && (
        <Tooltip label="Baked lighting" placement="right">
          <Button
            size="regular"
            variant="secondary"
            icon="box"
            aria-label="Baked lighting"
            onClick={toggleBakePanel}
          />
        </Tooltip>
      )}
    </div>
  )
}

export default Menu
