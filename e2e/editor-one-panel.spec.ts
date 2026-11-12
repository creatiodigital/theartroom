import type { UnknownAction } from '@reduxjs/toolkit'
import { test, expect } from '@playwright/test'

import dashboardReducer, {
  hideLightingPanel,
  showArtworkPanel,
  showBakePanel,
  showCameraPanel,
  showFloorPanel,
  showFurniturePanel,
  showLightingPanel,
  showPanelsPanel,
  showWallCeilingPanel,
  showWindowsPanel,
} from '../src/redux/slices/dashboardSlice'
import type { TDashboardState } from '../src/types/dashboard'

/**
 * The 3D editor's panels open one at a time (editor3d.md; questions.md Q139 h). The toolbar's
 * toggles close each other (Menu), but the Artwork panel, opened by a double click on a work in
 * the room, sat over an open tool panel in the same place. The store's open flags alone, no WebGL.
 */

type Flag = keyof TDashboardState

const TOOL_PANELS: [string, () => UnknownAction, Flag][] = [
  ['Lighting', showLightingPanel, 'isLightingPanelOpen'],
  ['Walls', showWallCeilingPanel, 'isWallCeilingPanelOpen'],
  ['Windows', showWindowsPanel, 'isWindowsPanelOpen'],
  ['Floor', showFloorPanel, 'isFloorPanelOpen'],
  ['Benches', showFurniturePanel, 'isFurniturePanelOpen'],
  ['Panels', showPanelsPanel, 'isPanelsPanelOpen'],
  ['View', showCameraPanel, 'isCameraPanelOpen'],
  ['Bake', showBakePanel, 'isBakePanelOpen'],
]

const after = (...actions: UnknownAction[]): TDashboardState =>
  actions.reduce(dashboardReducer, dashboardReducer(undefined, { type: '@@init' }))

test.describe('3D editor: one panel at a time (Q139 h)', () => {
  for (const [name, show, flag] of TOOL_PANELS) {
    test(`opening the Artwork panel closes ${name}`, () => {
      const state = after(show(), showArtworkPanel())
      expect(state[flag]).toBe(false)
      expect(state.isArtworkPanelOpen).toBe(true)
    })

    test(`opening ${name} closes the Artwork panel`, () => {
      const state = after(showArtworkPanel(), show())
      expect(state.isArtworkPanelOpen).toBe(false)
      expect(state[flag]).toBe(true)
    })
  }

  test("tool panels don't close each other here (the toolbar does)", () => {
    const state = after(showLightingPanel(), showFloorPanel())
    expect(state.isLightingPanelOpen).toBe(true)
    expect(state.isFloorPanelOpen).toBe(true)
  })

  test('closing a tool panel leaves the Artwork panel open', () => {
    const state = after(showArtworkPanel(), hideLightingPanel())
    expect(state.isArtworkPanelOpen).toBe(true)
  })
})
