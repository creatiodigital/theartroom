'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useSession, signOut } from 'next-auth/react'

import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorText } from '@/components/ui/ErrorText'
import { ExhibitionModal } from '@/components/ui/ExhibitionModal'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { Modal } from '@/components/ui/Modal'
import { H2, H3 } from '@/components/ui/Typography'
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
          <LoadingBar />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.main}>
        <div className={styles.header}>
          <H3>Hello {userData?.name ?? session?.user?.name ?? ''}</H3>
          <Button variant="link" label="Log out" onClick={() => signOut({ callbackUrl: '/' })} />
        </div>

        <div className={styles.exhibitions}>
          <div className={styles.sectionActions}>
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

          <H2 className={styles.sectionTitle}>My Exhibitions</H2>

          {exhibitions.length === 0 ? (
            <EmptyState message="You do not have any exhibitions yet." />
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Exhibition Name</th>
                  <th></th>
                  <th></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {exhibitions.map((ex: TExhibition) => (
                  <tr key={ex.id}>
                    <td>{ex.mainTitle}</td>
                    <td>
                      <Button
                        variant="small"
                        label="View"
                        onClick={() => handleViewExhibition(ex)}
                      />
                    </td>
                    <td>
                      <Button
                        variant="small"
                        label="Edit"
                        onClick={() => handleEditExhibition(ex)}
                      />
                    </td>
                    <td>
                      <Button
                        variant="small"
                        label="Delete"
                        onClick={() => handleDeleteExhibition(ex.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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

        <ErrorText>{error && `⚠️ ${JSON.stringify(error)}`}</ErrorText>
      </div>
    </div>
  )
}
