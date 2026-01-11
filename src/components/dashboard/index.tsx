'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useSession } from 'next-auth/react'

import { Button } from '@/components/ui/Button'
import { Logout } from '@/components/ui/Logout'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorText } from '@/components/ui/ErrorText'
import { ExhibitionModal } from '@/components/ui/ExhibitionModal'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { Modal } from '@/components/ui/Modal'
import { Text } from '@/components/ui/Typography'
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

  const handleEdit3DSpace = useCallback(
    (exhibition: TExhibition) => {
      const artistSlug = userHandler ?? ''
      const exhibitionSlug = exhibition.url
      router.push(`/exhibitions/${artistSlug}/${exhibitionSlug}/edit`)
    },
    [router, userHandler],
  )

  const handleEditExhibitionSettings = useCallback(
    (exhibition: TExhibition) => {
      router.push(`/dashboard/exhibitions/${exhibition.id}/settings`)
    },
    [router],
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
          <Text as="h1" font="sans">Hello {userData?.name ?? session?.user?.name ?? ''}</Text>
          <Logout />
        </div>

        {/* Artist Profile Section */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <Text as="h2" className={styles.sectionTitle}>My Profile</Text>
            <Button
              size="small"
              label="Edit Profile"
              onClick={() => router.push('/dashboard/profile')}
            />
          </div>
          <Text as="p" className={styles.sectionDescription}>
            Manage your artist profile, biography, and profile picture.
          </Text>
        </div>

        {/* Artwork Library Section */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <Text as="h2" className={styles.sectionTitle}>My Artworks</Text>
            <Button
              size="small"
              label="Manage Artworks"
              onClick={() => router.push('/dashboard/artworks')}
            />
          </div>
          <Text as="p" className={styles.sectionDescription}>
            Upload and manage your artwork collection. Artworks can be used across multiple exhibitions.
          </Text>
        </div>

        {/* Exhibitions Section */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <Text as="h2" className={styles.sectionTitle}>My Exhibitions</Text>
            <Button size="small" label="+ New Exhibition" onClick={handleNewExhibition} />
          </div>


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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {exhibitions.map((ex: TExhibition) => (
                  <tr key={ex.id}>
                    <td>{ex.mainTitle}</td>
                    <td>
                      <Button
                        size="small"
                        label="View"
                        onClick={() => handleViewExhibition(ex)}
                      />
                    </td>
                    <td>
                      <Button
                        size="small"
                        label="Edit Exhibition"
                        onClick={() => handleEditExhibitionSettings(ex)}
                      />
                    </td>
                    <td>
                      <Button
                        size="small"
                        label="Edit 3D Space"
                        onClick={() => handleEdit3DSpace(ex)}
                      />
                    </td>
                    <td>
                      <Button
                        size="small"
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
