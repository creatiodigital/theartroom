'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useSession } from 'next-auth/react'

import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorText } from '@/components/ui/ErrorText'
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

import { DashboardLayout } from './DashboardLayout'
import { spaceOptions } from './constants'
import dashboardStyles from './DashboardLayout/DashboardLayout.module.scss'

export const DashboardPage = () => {
  const dispatch = useDispatch<AppDispatch>()
  const router = useRouter()
  const { data: session } = useSession()
  const { effectiveUser } = useEffectiveUser()

  const selectedSpace = useSelector((state: RootState) => state.dashboard.selectedSpace)
  const exhibitions = useSelector(selectExhibitions)
  const [deleteExhibition] = useDeleteExhibitionMutation()

  const [isModalShown, setIsModalShown] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  const handleDeleteClick = useCallback((id: string, title: string) => {
    setDeleteTarget({ id, title })
  }, [])

  const handleDeleteConfirm = useCallback(
    async () => {
      if (!deleteTarget) return
      setDeleting(true)
      try {
        await deleteExhibition(deleteTarget.id).unwrap()
        dispatch(removeExhibition(deleteTarget.id))
        setDeleteTarget(null)
      } catch (err) {
        console.error('Failed to delete exhibition', err)
      } finally {
        setDeleting(false)
      }
    },
    [deleteExhibition, dispatch, deleteTarget],
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

  return (
    <DashboardLayout>
      {/* Page Title */}
      <h1 className={dashboardStyles.pageTitle}>
        Hello {userData?.name ?? session?.user?.name ?? ''}
      </h1>

      {/* Artist Profile Section */}
      <div className={dashboardStyles.section}>
        <div className={dashboardStyles.sectionHeader}>
          <h2 className={dashboardStyles.sectionTitle}>My Profile</h2>
          <Button
            font="dashboard"
            variant="secondary"
            label="Edit Profile"
            onClick={() => router.push('/dashboard/profile')}
          />
        </div>
        <p className={dashboardStyles.sectionDescription}>
          Manage your artist profile, biography, and profile picture.
        </p>
      </div>

      {/* Artwork Library Section */}
      <div className={dashboardStyles.section}>
        <div className={dashboardStyles.sectionHeader}>
          <h2 className={dashboardStyles.sectionTitle}>My Artworks</h2>
          <Button
            font="dashboard"
            variant="secondary"
            label="Manage Artworks"
            onClick={() => router.push('/dashboard/artworks')}
          />
        </div>
        <p className={dashboardStyles.sectionDescription}>
          Upload and manage your artwork collection. Artworks can be used across multiple
          exhibitions.
        </p>
      </div>

      {/* Exhibitions Section */}
      <div className={dashboardStyles.section}>
        <div className={dashboardStyles.sectionHeader}>
          <h2 className={dashboardStyles.sectionTitle}>My Exhibitions</h2>
          <Button
            font="dashboard"
            variant="secondary"
            label="New Exhibition"
            onClick={handleNewExhibition}
          />
        </div>

        {exhibitions.length === 0 ? (
          <EmptyState message="You do not have any exhibitions yet." />
        ) : (
          <table className={dashboardStyles.table}>
            <thead>
              <tr>
                <th>Exhibition Name</th>
                <th>Space</th>
                <th>Visibility</th>
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
                  <td>{spaceOptions.find((s) => s.value === ex.spaceId)?.label || ex.spaceId}</td>
                  <td>{ex.visibility === 'public' ? 'Public' : 'Private'}</td>
                  <td>
                    <Button
                      font="dashboard"
                      variant="secondary"
                      label="View"
                      onClick={() => handleViewExhibition(ex)}
                    />
                  </td>
                  <td>
                    <Button
                      font="dashboard"
                      variant="secondary"
                      label="Edit Exhibition"
                      onClick={() => handleEditExhibitionSettings(ex)}
                    />
                  </td>
                  <td>
                    <Button
                      font="dashboard"
                      variant="secondary"
                      label="Edit 3D Space"
                      onClick={() => handleEdit3DSpace(ex)}
                    />
                  </td>
                  <td>
                    <Button
                      font="dashboard"
                      variant="secondary"
                      label="Delete"
                      onClick={() => handleDeleteClick(ex.id, ex.mainTitle)}
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

      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)}>
          <div className={dashboardStyles.deleteModal}>
            <h2>Delete Exhibition</h2>
            <p>
              Are you sure you want to delete <strong>{deleteTarget.title}</strong>?
              This will permanently remove the exhibition and all its data.
            </p>
            <div className={dashboardStyles.deleteWarning}>
              This action is not reversible. Please be certain.
            </div>
            <div className={dashboardStyles.deleteActions}>
              <Button
                font="dashboard"
                variant="secondary"
                label="Cancel"
                onClick={() => setDeleteTarget(null)}
              />
              <Button
                font="dashboard"
                variant="primary"
                label={deleting ? 'Deleting...' : 'Delete'}
                onClick={handleDeleteConfirm}
                disabled={deleting}
              />
            </div>
          </div>
        </Modal>
      )}
    </DashboardLayout>
  )
}
