import type { RootState } from '@/redux/store'
import type { AutofocusGroup } from '@/types/autofocusGroup'

/**
 * One shared empty array for exhibitions that have no autofocus groups.
 *
 * `useSelector(s => s.exhibition.autofocusGroups ?? [])` allocates a NEW array
 * on every call, so Redux compares two different references, decides the value
 * changed and re-renders — on every store update, for every artwork in the
 * room. React-Redux warns about exactly this. Returning the same frozen array
 * makes the comparison stable.
 */
const NO_GROUPS: readonly AutofocusGroup[] = Object.freeze([])

export const selectAutofocusGroups = (state: RootState): readonly AutofocusGroup[] =>
  state.exhibition.autofocusGroups ?? NO_GROUPS
