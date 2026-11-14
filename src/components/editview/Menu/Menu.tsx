'use client'

import { useId } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useSession } from 'next-auth/react'
import {
  Armchair,
  ArrowLeft,
  Camera,
  Columns,
  Cube,
  FrameCorners,
  GridFour,
  Lightbulb,
  PaintRoller,
  Rows,
  type Icon,
} from '@phosphor-icons/react'
import c from 'classnames'

import { isBakedSpace } from '@/lib/bake/bakedSpaces'
import { RoomLanguageSwitch } from '@/components/exhibitions/RoomLanguageSwitch/RoomLanguageSwitch'
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

import { EditingPill } from './EditingPill'
import styles from './Menu.module.scss'

type ToolProps = {
  label: string
  /** Today's tooltip: the longer description (editor3d.md: tooltips can stay). */
  tooltip: string
  icon: Icon
  onClick: () => void
  /** Its panel is open (or, for Spots, the placeholders are shown). Omitted: not a toggle. */
  pressed?: boolean
}

/** One toolbar tool: the icon with its label under it (editor3d.md "Toolbar"). */
const Tool = ({ label, tooltip, icon: ToolIcon, onClick, pressed }: ToolProps) => (
  <Tooltip label={tooltip} placement="right" fullWidth>
    <Button
      variant="bare"
      font="dashboard"
      className={styles.tool}
      aria-pressed={pressed}
      onClick={onClick}
    >
      <ToolIcon size={22} weight={pressed ? 'fill' : 'light'} aria-hidden />
      <span className={styles.toolLabel}>{label}</span>
    </Button>
  </Tooltip>
)

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
  const isArtworkPanelOpen = useSelector((state: RootState) => state.dashboard.isArtworkPanelOpen)
  // A tool panel on the right: the language preview waits beside it.
  const anyPanelOpen =
    isLightingPanelOpen ||
    isPanelsPanelOpen ||
    isFurniturePanelOpen ||
    isFloorPanelOpen ||
    isCameraPanelOpen ||
    isWallCeilingPanelOpen ||
    isWindowsPanelOpen ||
    isBakePanelOpen ||
    isArtworkPanelOpen
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

  const roomCaptionId = useId()

  return (
    <>
      {/* Q139 (d): the room's camera skips a wheel or a press inside `[data-panel-overlay]`
          (MainCamera), as on the panels and the visitor's RoomMenu: the wheel scrolls the toolbar
          when it overflows (Q138) instead of walking the room, and a drag from it doesn't turn it. */}
      <nav aria-label="Editor tools" className={styles.toolbar} data-panel-overlay>
        <Tool label="Exit" tooltip="Back to dashboard" icon={ArrowLeft} onClick={handleClose} />
        {/* Was "Spots" (owner, 2026-11-13: not clear). The dashed outlines of the walls where works
            hang; double-clicking one opens that wall to arrange it. */}
        <Tool
          label="Hanging"
          tooltip={
            isPlaceholdersShown
              ? 'Hide the hanging walls. Double-click an outlined wall to arrange its works'
              : 'Show the hanging walls, to arrange the works on them'
          }
          icon={FrameCorners}
          pressed={isPlaceholdersShown}
          onClick={() => togglePlaceholders()}
        />
        <span aria-hidden className={styles.divider} />
        <div role="group" aria-labelledby={roomCaptionId} className={styles.group}>
          <span id={roomCaptionId} className={styles.caption}>
            Room
          </span>
          <Tool
            label="Lighting"
            tooltip="Lighting controls"
            icon={Lightbulb}
            pressed={isLightingPanelOpen}
            onClick={toggleLightingPanel}
          />
          <Tool
            label="Walls"
            tooltip="Walls and ceiling"
            icon={PaintRoller}
            pressed={isWallCeilingPanelOpen}
            onClick={toggleWallCeilingPanel}
          />
          <Tool
            label="Windows"
            tooltip="Windows and radiators"
            icon={GridFour}
            pressed={isWindowsPanelOpen}
            onClick={toggleWindowsPanel}
          />
          {/* AR-161 (spec rule 3): a baked space has one floor — there, the panel sets only the
              boards' size and placement (AR-163). */}
          <Tool
            label="Floor"
            tooltip="Floor controls"
            icon={Rows}
            pressed={isFloorPanelOpen}
            onClick={toggleFloorPanel}
          />
          {FURNITURE_PANEL_ENABLED && (
            <Tool
              label="Benches"
              tooltip="Furniture"
              icon={Armchair}
              pressed={isFurniturePanelOpen}
              onClick={toggleFurniturePanel}
            />
          )}
          <Tool
            label="Panels"
            tooltip="Display panels"
            icon={Columns}
            pressed={isPanelsPanelOpen}
            onClick={togglePanelsPanel}
          />
        </div>
        <span aria-hidden className={styles.divider} />
        <Tool
          label="View"
          tooltip="Camera controls"
          icon={Camera}
          pressed={isCameraPanelOpen}
          onClick={toggleCameraPanel}
        />
        {showBake && (
          <Tool
            label="Bake"
            tooltip="Baked lighting"
            icon={Cube}
            pressed={isBakePanelOpen}
            onClick={toggleBakePanel}
          />
        )}
      </nav>
      <EditingPill />
      {/* AR-182: the 3D view's English | second-language preview (README, answers 2026-11-14): the whole room
          in the second language, untranslated texts in English. Editors only, even while visitors
          don't see the switch; never saved; the editor opens in English. */}
      <div
        className={c(styles.languageSwitch, anyPanelOpen && styles.languageSwitchBesidePanel)}
        data-panel-overlay
      >
        <RoomLanguageSwitch tone="editor" />
      </div>
    </>
  )
}

export default Menu
