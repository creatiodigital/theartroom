'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback, useId } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useSession } from 'next-auth/react'
import c from 'classnames'

import { Bank, Cube, Images, Plus, User, type Icon } from '@phosphor-icons/react'

import { AdminConfirmModal } from '@/components/admin/ui/AdminConfirmModal'
import { Callout } from '@/components/admin/ui/Callout'
import { EmptyState } from '@/components/admin/ui/EmptyState'
import { FeedbackBar } from '@/components/admin/ui/FeedbackBar'
import { PublishState } from '@/components/admin/ui/PublishState'
import { RowMenu } from '@/components/admin/ui/RowMenu'
import { StatusPill } from '@/components/admin/ui/StatusPill'
import { Button } from '@/components/ui/Button'
import { ExhibitionModal } from '@/components/ui/ExhibitionModal'
import { Modal } from '@/components/ui/Modal'

import { useEffectiveUser } from '@/hooks/useEffectiveUser'
import { isSafeImageSrc } from '@/lib/imageSafety'
import { selectExhibitionsForUser } from '@/redux/selectors/userSelectors'
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
import dashboardStyles from './DashboardLayout/DashboardLayout.module.scss'
import styles from './Home.module.scss'

/** A row of the exhibitions list: every GET /api/exhibitions row carries its featured image. */
type HomeExhibition = TExhibition & { featuredImageUrl?: string | null }

type Shortcut = {
  href: string
  icon: Icon
  title: string
  text: string
  cta: string
}

// The three shortcut cards (artist.md §1). Payouts stays neutral: nothing the
// studio has knows the payouts state (questions.md Q98).
const SHORTCUTS: Shortcut[] = [
  {
    href: '/dashboard/artworks',
    icon: Images,
    title: 'Artworks',
    text: 'Add images, texts, sound and video, and choose which prints you sell.',
    cta: 'Open library',
  },
  {
    href: '/dashboard/profile',
    icon: User,
    title: 'Profile',
    text: 'Your photo, signature, name and biography on your public page.',
    cta: 'Edit profile',
  },
  {
    href: '/dashboard/payouts',
    icon: Bank,
    title: 'Payouts',
    text: 'Connect a bank account with Stripe so we can pay you for your sales.',
    cta: 'Set up payouts',
  },
]

const exhibitionsCount = (n: number) => (n === 1 ? '1 exhibition' : `${n} exhibitions`)

/** One card: named by its title, its line read as the description. */
function ShortcutCard({ shortcut }: { shortcut: Shortcut }) {
  const id = useId()
  const TileIcon = shortcut.icon
  return (
    <li>
      <Link
        href={shortcut.href}
        className={styles.tile}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-text`}
      >
        <span aria-hidden className={styles.tileIcon}>
          <TileIcon size={20} weight="light" />
        </span>
        <span id={`${id}-title`} className={styles.tileTitle}>
          {shortcut.title}
        </span>
        <span id={`${id}-text`} className={styles.tileText}>
          {shortcut.text}
        </span>
        <span className={styles.tileCta}>
          {shortcut.cta}
          <span aria-hidden> →</span>
        </span>
      </Link>
    </li>
  )
}

export const DashboardPage = () => {
  const dispatch = useDispatch<AppDispatch>()
  const router = useRouter()
  const { data: session } = useSession()
  const { effectiveUser, isImpersonating } = useEffectiveUser()

  // The effective user — the impersonated artist when an admin is impersonating.
  const userId = effectiveUser?.id
  const userHandler = effectiveUser?.handler

  const selectedSpace = useSelector((state: RootState) => state.dashboard.selectedSpace)
  // Owner-guarded read: the store is global and outlives a user switch, so this
  // returns nothing rather than the previous user's exhibitions.
  const exhibitions = useSelector((state: RootState) => selectExhibitionsForUser(state, userId))
  const [deleteExhibition] = useDeleteExhibitionMutation()

  const [isModalShown, setIsModalShown] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  // questions.md Q108 (d): a refused delete is said on screen (it was console only).
  const [deleteError, setDeleteError] = useState('')

  const { data: userData } = useGetUserQuery(userId ?? '', {
    skip: !userId,
  })
  const {
    data: exhibitionsData,
    // Which user this data was actually fetched FOR. Tagging the store with
    // this rather than with the current `userId` means a response that lands
    // after a user switch can never be filed under the wrong owner.
    originalArgs: exhibitionsOwnerId,
    isError: exhibitionsFailed,
    isLoading: exhibitionsLoading,
    refetch: refetchExhibitions,
  } = useGetExhibitionsByUserQuery(userId ?? '', {
    skip: !userId,
  })

  const [createExhibition, { isLoading: creating, error }] = useCreateExhibitionMutation()

  useEffect(() => {
    if (exhibitionsData && exhibitionsOwnerId) {
      dispatch(hydrateExhibitions({ ownerId: exhibitionsOwnerId, exhibitions: exhibitionsData }))
    }
  }, [exhibitionsData, exhibitionsOwnerId, dispatch])

  // Refetch exhibitions when switching users (e.g. after admin deletes then impersonates)
  useEffect(() => {
    if (userId) {
      refetchExhibitions()
    }
  }, [userId, refetchExhibitions])

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
    async (mainTitle: string, customUrl: string) => {
      try {
        const newEx = await createExhibition({
          mainTitle,
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

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteExhibition(deleteTarget.id).unwrap()
      dispatch(removeExhibition(deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      console.error('Failed to delete exhibition', err)
      setDeleteError(`Couldn't delete ${deleteTarget.title}. Please try again.`)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }, [deleteExhibition, dispatch, deleteTarget])

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

  // Show "Back to Admin Dashboard" for admins/superadmins using test dashboard
  const userType = session?.user?.userType
  const isAdminOrSuperAdmin = userType === 'admin' || userType === 'superAdmin'
  const showBackToAdmin = isAdminOrSuperAdmin && !isImpersonating

  // ── Render-only ──
  const panelTitleId = useId()
  // While impersonating, the artist's name until their record loads, never the admin's (Q108 c).
  const greetingName = userData?.name ?? effectiveUser?.name ?? ''
  const listed = exhibitions.length > 0

  return (
    <div className={styles.page}>
      {/* The old frame's header link, kept in the page: its target isn't in the
          studio menu (questions.md Q99). */}
      {showBackToAdmin && (
        <Link href="/admin/dashboard" className={c(dashboardStyles.backLink, styles.backLink)}>
          ← Back to Admin Dashboard
        </Link>
      )}

      <header className={styles.header}>
        <h1 className={styles.greeting}>{greetingName ? `Hello, ${greetingName}` : 'Hello'}</h1>
        <p className={styles.sub}>Your exhibitions, artworks and profile, all in one place.</p>
      </header>

      {deleteError && (
        <FeedbackBar tone="error" onDismiss={() => setDeleteError('')}>
          {deleteError}
        </FeedbackBar>
      )}

      <ul className={styles.tiles}>
        {SHORTCUTS.map((shortcut) => (
          <ShortcutCard key={shortcut.href} shortcut={shortcut} />
        ))}
      </ul>

      <section aria-labelledby={panelTitleId} className={styles.panel}>
        <div className={styles.panelHead}>
          <div className={styles.panelTitles}>
            <h2 id={panelTitleId} className={styles.panelTitle}>
              My exhibitions
            </h2>
            {listed && <span className={styles.count}>{exhibitionsCount(exhibitions.length)}</span>}
          </div>
          <Button
            variant="bare"
            font="dashboard"
            className={styles.add}
            onClick={handleNewExhibition}
          >
            <Plus size={16} weight="light" aria-hidden />
            New exhibition
          </Button>
        </div>

        {/* A failed load used to be completely silent: the list simply stayed as
            it was, which is what let a stale one pass for the real thing. Say so
            instead — an empty list and a broken list are different facts. */}
        {exhibitionsFailed ? (
          <div className={styles.panelBody}>
            <Callout tone="red" role="alert">
              Could not load exhibitions. Refresh the page to try again.
            </Callout>
          </div>
        ) : !listed ? (
          exhibitionsLoading ? (
            <p className={styles.loading}>Loading exhibitions…</p>
          ) : (
            <EmptyState title="You do not have any exhibitions yet." />
          )
        ) : (
          <ul className={styles.rows}>
            {exhibitions.map((ex: HomeExhibition) => {
              const space = spaceOptions.find((s) => s.value === ex.spaceId)?.label || ex.spaceId
              const image =
                ex.featuredImageUrl && isSafeImageSrc(ex.featuredImageUrl)
                  ? ex.featuredImageUrl
                  : null
              return (
                <li key={ex.id} className={styles.row}>
                  <span className={styles.image}>
                    {image && (
                      <Image
                        src={image}
                        alt=""
                        fill
                        sizes="96px"
                        // Skip the Vercel optimizer: already-optimized .webp on
                        // R2/CDN; cold re-encodes broke images on first load (AR-125).
                        unoptimized
                        className={styles.imageFill}
                      />
                    )}
                  </span>
                  <div className={styles.text}>
                    <Link
                      href={`/dashboard/exhibitions/${ex.id}/settings`}
                      prefetch={false}
                      className={styles.name}
                    >
                      {ex.mainTitle}
                    </Link>
                    <span className={styles.meta}>
                      <span className={styles.space}>{space}</span>
                      <PublishState published={ex.published} />
                      {ex.published && ex.hasPendingChanges ? (
                        <StatusPill label="Pending changes" tone="amber" shape="tag" />
                      ) : ex.published ? (
                        <StatusPill label="Up to date" tone="green" shape="tag" />
                      ) : null}
                    </span>
                  </div>
                  <div className={styles.actions}>
                    {/* The same URL handleEdit3DSpace opens (the menu item keeps the handler). */}
                    <Button
                      variant="bare"
                      font="dashboard"
                      href={`/exhibitions/${userHandler ?? ''}/${ex.url}/edit`}
                      prefetch={false}
                      className={styles.edit3d}
                    >
                      <Cube size={16} weight="light" aria-hidden />
                      Edit 3D space
                    </Button>
                    <RowMenu
                      label={`Actions for ${ex.mainTitle}`}
                      width={210}
                      groups={[
                        {
                          items: [
                            {
                              id: 'view',
                              label: 'View exhibition',
                              hint: !ex.published ? 'Not published yet' : undefined,
                              disabled: !ex.published,
                              onSelect: () => handleViewExhibition(ex),
                            },
                            {
                              id: 'settings',
                              label: 'Exhibition settings',
                              onSelect: () => handleEditExhibitionSettings(ex),
                            },
                            {
                              id: 'edit-3d',
                              label: 'Edit 3D space',
                              onSelect: () => handleEdit3DSpace(ex),
                            },
                          ],
                        },
                        // Admins only, as before; for artists the group is empty and drops.
                        {
                          items: isAdminOrSuperAdmin
                            ? [
                                {
                                  id: 'delete',
                                  label: 'Delete exhibition…',
                                  tone: 'danger',
                                  onSelect: () => handleDeleteClick(ex.id, ex.mainTitle),
                                },
                              ]
                            : [],
                        },
                      ]}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

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

      {/* The create request's error, as before (questions.md Q104). */}
      {error && (
        <Callout tone="red" role="alert">
          {JSON.stringify(error)}
        </Callout>
      )}

      {deleteTarget && (
        <AdminConfirmModal
          title="Delete exhibition"
          message={
            <p>
              Are you sure you want to delete <strong>{deleteTarget.title}</strong>? This will
              permanently remove the exhibition and all its data.
            </p>
          }
          warning="This action is not reversible. Please be certain."
          confirmLabel="Delete"
          busyLabel="Deleting…"
          destructive
          busy={deleting}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
