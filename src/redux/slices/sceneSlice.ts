import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import { sceneFactory } from '@/factories/sceneFactory'
import type { TScene, TLampGroup, TFocusTarget, TExitPromptSource } from '@/types/scene'

const sceneSlice = createSlice({
  name: 'scene',
  initialState: sceneFactory(),
  reducers: {
    setCurrentArtwork: (state: TScene, action: PayloadAction<string | null>) => {
      state.currentArtworkId = action.payload
    },

    showPlaceholders: (state: TScene) => {
      state.isPlaceholdersShown = true
    },

    hidePlaceholders: (state: TScene) => {
      state.isPlaceholdersShown = false
    },

    addWall: (state: TScene, action: PayloadAction<{ id: string }>) => {
      const wallId = action.payload.id
      const wallIndex = state.walls.length + 1
      const readableName = `Wall ${wallIndex}`
      state.walls.push({ id: wallId, name: readableName })
    },

    setFocusTarget: (state: TScene, action: PayloadAction<TFocusTarget>) => {
      state.focusTarget = action.payload
    },

    clearFocusTarget: (state: TScene) => {
      state.focusTarget = null
    },

    /** MainCamera: the visitor entered or left Artwork View ("Wall View"). */
    setInArtworkView: (state: TScene, action: PayloadAction<boolean>) => {
      state.inArtworkView = action.payload
    },

    /** The Exit Wall View button: MainCamera steps back from the wall. */
    requestArtworkViewExit: (state: TScene) => {
      state.artworkViewExitNonce += 1
    },

    resetScene: () => {
      // Return fresh initial state to prevent stale data between exhibitions
      return sceneFactory()
    },

    /** Set from the GLB at load. Replaces any previous space's lamps outright,
     *  so switching exhibitions can never leave a stale lamp count behind. */
    setTrackLampGroups: (state: TScene, action: PayloadAction<TLampGroup[]>) => {
      state.trackLampGroups = action.payload
    },
    setInitialCameraFromNode: (
      state: TScene,
      action: PayloadAction<{ position: [number, number]; direction: [number, number] }>,
    ) => {
      state.initialCameraPosition = action.payload.position
      state.initialCameraDirection = action.payload.direction
    },

    openExitPrompt: (state: TScene, action: PayloadAction<TExitPromptSource>) => {
      state.isExitPromptOpen = true
      state.exitPromptSource = action.payload
    },

    /**
     * Declined to leave. Every way of saying no lands here — the Stay button, Escape and a
     * backdrop click — so they all behave identically. Where the visitor goes depends on what
     * raised the prompt (AR-174): having walked up to the exit, they restart from the entrance
     * (off the threshold, so it can't fire again under them); having pressed the close button,
     * anywhere in the room, they stay exactly where they are. The dialog says which.
     */
    declineExit: (state: TScene) => {
      if (state.exitPromptSource === 'walk') state.exitRespawnNonce += 1
      state.isExitPromptOpen = false
      state.exitPromptSource = null
    },

    /** AR-182: the room's texts in the second language (its code) or in English (null). */
    setRoomLanguage: (state: TScene, action: PayloadAction<string | null>) => {
      state.roomLanguage = action.payload
    },
  },
})

export const {
  setCurrentArtwork,
  showPlaceholders,
  hidePlaceholders,
  addWall,
  setFocusTarget,
  clearFocusTarget,
  setInArtworkView,
  requestArtworkViewExit,
  resetScene,
  setInitialCameraFromNode,
  setTrackLampGroups,
  openExitPrompt,
  declineExit,
  setRoomLanguage,
} = sceneSlice.actions

export default sceneSlice.reducer
