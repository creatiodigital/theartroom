'use client'

import { useSession } from 'next-auth/react'
import { useEffect } from 'react'

import { markInternalTraffic } from '@/lib/analytics/track'

// Only the gallery's own people sign in (admin, artists, curators), so a signed-in browser is never
// a buyer's. Marked once; the flag stays after sign-out so later public visits stay internal too.
const INTERNAL_TYPES = new Set(['admin', 'superAdmin', 'artist', 'curator'])

export const InternalTrafficMarker = () => {
  const { data } = useSession()
  const userType = data?.user?.userType

  useEffect(() => {
    if (userType && INTERNAL_TYPES.has(userType)) markInternalTraffic()
  }, [userType])

  return null
}
