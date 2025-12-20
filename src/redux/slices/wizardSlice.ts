import { createSlice } from '@reduxjs/toolkit'

import { wizardFactory } from '@/factories/wizardFactory'
import type { TWizard } from '@/types/wizard'

const wizardSlice = createSlice({
  name: 'wizard',
  initialState: wizardFactory(),
  reducers: {
    showWizard: (state: TWizard) => {
      state.isWizardOpen = true
    },
    hideWizard: (state: TWizard) => {
      state.isWizardOpen = false
    },
    setArtworkUploadedTrue: (state: TWizard) => {
      state.isArtworkUploaded = true
    },
    setArtworkUploadedFalse: (state: TWizard) => {
      state.isArtworkUploaded = false
    },

    resetWizard: () => {
      // Return fresh initial state to prevent stale data between exhibitions
      return wizardFactory()
    },
  },
})

export const {
  showWizard,
  hideWizard,
  setArtworkUploadedTrue,
  setArtworkUploadedFalse,
  resetWizard,
} = wizardSlice.actions

export default wizardSlice.reducer
