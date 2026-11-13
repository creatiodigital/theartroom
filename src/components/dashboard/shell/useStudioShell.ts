'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

import { useEffectiveUser } from '@/hooks/useEffectiveUser'
import { useGetUserQuery } from '@/redux/slices/userApi'

import { PROFILE_PATH } from './studioNav'

export type StudioImpersonation = {
  /** The impersonated user's full name. */
  name: string
  stop: () => Promise<void>
}

/**
 * Set while an admin impersonates, else null. The condition and the Stop
 * handler are the old DashboardLayout's, verbatim. Its condition also had
 * `!isAdminArea`, which is always true under /dashboard. The studio never ends
 * an impersonation on its own: only Stop does (and AdminLayout, on an admin page).
 */
export function useStudioImpersonation(): StudioImpersonation | null {
  const { effectiveUser, isImpersonating, stopImpersonation } = useEffectiveUser()
  const router = useRouter()

  const stop = useCallback(async () => {
    await stopImpersonation()
    router.push('/admin/dashboard')
  }, [stopImpersonation, router])

  if (!(isImpersonating && effectiveUser)) return null
  return { name: effectiveUser.name ?? '', stop }
}

export type StudioPerson = {
  name: string
  imageUrl: string | null
  /** The public artist page, or null without a handler. */
  publicHref: string | null
}

/**
 * Who the studio is for (the impersonated artist while impersonating), for the
 * foot of the menu. The photo and the last name come from the user record,
 * through the same RTK query Home already makes (questions.md Q96); until it
 * lands, or if it fails, the session's name.
 */
export function useStudioPerson(): StudioPerson {
  const { data: session } = useSession()
  const { effectiveUser } = useEffectiveUser()
  const id = effectiveUser?.id
  // `currentData`: only ever this user's record, never the previous user's.
  const { currentData: user } = useGetUserQuery(id ?? '', { skip: !id })

  const fullName = user ? `${user.name ?? ''} ${user.lastName ?? ''}`.trim() : ''
  const name = fullName || effectiveUser?.name?.trim() || session?.user?.email || 'Artist'
  const handler = user?.handler || effectiveUser?.handler

  return {
    name,
    imageUrl: user?.profileImageUrl || null,
    publicHref: handler ? `/artists/${handler}` : null,
  }
}

/**
 * Profile saves with plain `fetch`, which RTK never hears about: re-read the
 * user record once on leaving it, so the menu (and Home's greeting) show the
 * new photo, name and URL.
 */
export function useRefreshPersonAfterProfile(pathname: string): void {
  const { effectiveUser } = useEffectiveUser()
  const id = effectiveUser?.id
  const { refetch } = useGetUserQuery(id ?? '', { skip: !id })
  const previous = useRef(pathname)

  useEffect(() => {
    const left = previous.current
    previous.current = pathname
    if (id && left === PROFILE_PATH && pathname !== PROFILE_PATH) void refetch()
  }, [pathname, id, refetch])
}
