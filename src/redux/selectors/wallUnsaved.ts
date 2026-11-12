import type { RootState } from '@/redux/store'

/**
 * The wall view has edits the server doesn't have yet (questions.md Q142): counted since the wall
 * opened, minus those an accepted save was sent with. Display only.
 */
export const selectWallUnsaved = (state: Pick<RootState, 'wallView'>): boolean =>
  state.wallView.wallEdits > state.wallView.wallEditsSaved
