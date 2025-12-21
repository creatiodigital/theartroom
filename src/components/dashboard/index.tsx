'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useSession, signOut } from 'next-auth/react'

import { Button } from '@/components/ui/Button'
import { ExhibitionModal } from '@/components/ui/ExhibitionModal'
import { Modal } from '@/components/ui/Modal'
import { useEffectiveUser } from '@/hooks/useEffectiveUser'
import { selectExhibitions } from '@/redux/selectors/userSelectors'
import { selectSpace } from '@/redux/slices/dashboardSlice'
import {
  useGetExhibitionsByUserQuery,
  useCreateExhibitionMutation,
  useDeleteExhibitionMutation,
} from '@/redux/slices/exhibitionApi'
import { useGetUserQuery } from '@/redux/slices/userApi'
import { addExhibition, hydrateExhibitions, removeExhibition } from '@/redux/slices/userSlice'
import type { RootState, AppDispatch } from '@/redux/store'
import type { TOption } from '@/types/artwork'
import type { TSpaceOption } from '@/types/dashboard'
import type { TExhibition } from '@/types/exhibition'

import { spaceOptions } from './constants'
import styles from './Dashboard.module.scss'

export const DashboardPage = () => {
  const dispatch = useDispatch<AppDispatch>()
  const router = useRouter()
  const { data: session, status: sessionStatus } = useSession()
  const { effectiveUser } = useEffectiveUser()

  const selectedSpace = useSelector((state: RootState) => state.dashboard.selectedSpace)
  const exhibitions = useSelector(selectExhibitions)
  const [deleteExhibition] = useDeleteExhibitionMutation()

  const [isModalShown, setIsModalShown] = useState(false)

  // Use effective user ID (handles impersonation)
  const userId = effectiveUser?.id
  const userHandler = effectiveUser?.handler

  const { data: userData } = useGetUserQuery(userId ?? '', {
    skip: !userId,
  })
  const { data: exhibitionsData, refetch: refetchExhibitions } = useGetExhibitionsByUserQuery(
    userId ?? '',
    {
      skip: !userId,
    },
  )

  const [createExhibition, { isLoading: creating, error }] = useCreateExhibitionMutation()

  useEffect(() => {
    if (exhibitionsData) {
      dispatch(hydrateExhibitions(exhibitionsData))
    }
  }, [exhibitionsData, dispatch])

  const handleSelectSpace = useCallback(
    (option: TOption<string>) => {
      dispatch(selectSpace(option as TSpaceOption))
    },
    [dispatch],
  )

  const handleNewExhibition = useCallback(() => {
    setIsModalShown(true)
  }, [])

  const handleCreateExhibition = useCallback(
    async (mainTitle: string, visibility: string, customUrl: string) => {
      try {
        const newEx = await createExhibition({
          mainTitle,
          visibility,
          userId: userId ?? '',
          userHandler: userHandler ?? '',
          spaceId: selectedSpace.value,
          customUrl,
        }).unwrap()
        dispatch(addExhibition(newEx))
        refetchExhibitions()
        setIsModalShown(false)
      } catch (err) {
        console.error('Failed to create exhibition', err)
      }
    },
    [createExhibition, dispatch, userId, userHandler, selectedSpace, refetchExhibitions],
  )

  const handleDeleteExhibition = useCallback(
    async (id: string) => {
      try {
        await deleteExhibition(id).unwrap()
        dispatch(removeExhibition(id))
      } catch (err) {
        console.error('Failed to delete exhibition', err)
      }
    },
    [deleteExhibition, dispatch],
  )

  const handleEditExhibition = useCallback(
    (exhibition: TExhibition) => {
      const artistSlug = userHandler ?? ''
      const exhibitionSlug = exhibition.url
      router.push(`/exhibitions/${artistSlug}/${exhibitionSlug}/edit`)
    },
    [router, userHandler],
  )

  const handleViewExhibition = useCallback(
    (exhibition: TExhibition) => {
      const artistSlug = userHandler ?? ''
      const exhibitionSlug = exhibition.url
      router.push(`/exhibitions/${artistSlug}/${exhibitionSlug}`)
    },
    [router, userHandler],
  )

  // Redirect to home if not logged in
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/')
    }
  }, [sessionStatus, router])

  // Show loading while checking session or if unauthenticated (redirect pending)
  if (sessionStatus === 'loading' || sessionStatus === 'unauthenticated') {
    return (
      <div className={styles.dashboard}>
        <div className={styles.main}>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.main}>
        <div className={styles.header}>
          <h3>Hello {userData?.name ?? session?.user?.name ?? ''}</h3>
          <Button variant="small" label="Log out" onClick={() => signOut({ callbackUrl: '/' })} />
        </div>

        <div className={styles.exhibitions}>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <Button variant="small" label="New exhibition" onClick={handleNewExhibition} />
            <Button
              variant="small"
              label="Artwork Library"
              onClick={() => router.push('/dashboard/artworks')}
            />
            <Button
              variant="small"
              label="Edit Profile"
              onClick={() => router.push('/dashboard/profile')}
            />
          </div>
          <div className={styles.list}>
            <h3 className={styles.subtitle}>My exhibitions</h3>
            {exhibitions.length === 0 ? (
              <p>You do not have any exhibitions yet.</p>
            ) : (
              <ul className={styles.exhibitionList}>
                {exhibitions.map((ex: TExhibition) => (
                  <li key={ex.id} className={styles.exhibitionItem}>
                    {ex.mainTitle}{' '}
                    <Button variant="small" label="View" onClick={() => handleViewExhibition(ex)} />
                    <Button variant="small" label="Edit" onClick={() => handleEditExhibition(ex)} />
                    <Button
                      variant="small"
                      label="Delete"
                      onClick={() => handleDeleteExhibition(ex.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {isModalShown && (
          <Modal onClose={() => setIsModalShown(false)}>
            <ExhibitionModal
              creating={creating}
              onClose={() => setIsModalShown(false)}
              onCreate={handleCreateExhibition}
              selectedSpace={selectedSpace}
              handleSelectSpace={handleSelectSpace}
              spaceOptions={spaceOptions}
              userId={userId ?? ''}
            />
          </Modal>
        )}

        {error && <p className={styles.error}>⚠️ {JSON.stringify(error)}</p>}
      </div>
    </div>
  )
}
