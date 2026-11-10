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
    resetWizard: () => {
      // Return fresh initial state to prevent stale data between exhibitions
      return wizardFactory()
    },
  },
})

export const {
  showWizard,
  hideWizard,
  resetWizard,
} = wizardSlice.actions

export default wizardSlice.reducer
