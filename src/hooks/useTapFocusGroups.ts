'use client'

import { useSelector } from 'react-redux'

import { useIsPhone } from '@/hooks/useIsPhone'
import { NO_GROUPS, selectAutofocusGroups } from '@/redux/selectors/autofocusGroups'

/**
 * The autofocus groups a tap or click in the 3D room frames as one: an exhibition's own groups on
 * laptops, desktops and tablets, none on phones (AR-174). A group framed whole doesn't fit a
 * phone's screen, so there a tap frames just the work or the text that was tapped. Every
 * exhibition, every space; the groups themselves stay as the curator made them.
 */
export const useTapFocusGroups = () => {
  const groups = useSelector(selectAutofocusGroups)
  return useIsPhone() ? NO_GROUPS : groups
}
