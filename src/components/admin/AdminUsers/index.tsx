'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { EnvelopeSimple, Plus, Star } from '@phosphor-icons/react'

import { AddArtistModal } from '@/components/admin/AddArtistModal'
import { AdminConfirmModal } from '@/components/admin/ui/AdminConfirmModal'
import { AdminPageHeader } from '@/components/admin/ui/AdminPageHeader'
import { Callout } from '@/components/admin/ui/Callout'
import { DataTable } from '@/components/admin/ui/DataTable'
import { EmptyState } from '@/components/admin/ui/EmptyState'
import { FeedbackBar } from '@/components/admin/ui/FeedbackBar'
import { initialsOf } from '@/components/admin/ui/initials'
import { ListPanel } from '@/components/admin/ui/ListPanel'
import { PublishState } from '@/components/admin/ui/PublishState'
import { RowMenu, type RowMenuGroup, type RowMenuItem } from '@/components/admin/ui/RowMenu'
import { SegmentedControl } from '@/components/admin/ui/SegmentedControl'
import { StatusPill } from '@/components/admin/ui/StatusPill'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { useEffectiveUser } from '@/hooks/useEffectiveUser'
import { useUsers } from '@/hooks/useUsers'
import type { TUser } from '@/types/user'

import styles from './Users.module.scss'

const PAGE_PATH = '/admin/users'

// The Type filter (users.md, NEW): client-side over the loaded users, kept in
// the URL as ?type= so a filtered view survives Back (as Kind on Gift orders).
type TypeFilter = 'artists' | 'admins' | 'curators'

const matchesType = (user: TUser, type: TypeFilter) =>
  type === 'artists'
    ? user.userType === 'artist'
    : type === 'admins'
      ? user.userType === 'admin' || user.userType === 'superAdmin'
      : user.userType === 'curator'

/** Today's Type labels; any other value (e.g. "general") shows as it is. */
const typeLabel = (userType: string | undefined) =>
  ({
    superAdmin: 'Super Admin',
    admin: 'Admin',
    artist: 'Artist',
    curator: 'Curator',
  })[userType ?? ''] || userType

const fullName = (user: TUser) => `${user.name} ${user.lastName}`.trim()

const usersCount = (n: number) => `${n} ${n === 1 ? 'user' : 'users'}`

// Q35: the red bar's text for a failed Publish / Featured.
const couldNotUpdate = (userName: string) => `Couldn't update ${userName}. Please try again.`

/** The server's own `{ error }` text when it sends one, else `couldNotUpdate`. */
const rowErrorText = async (response: Response, userName: string) => {
  const data: unknown = await response.json().catch(() => null)
  const serverError =
    data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
      ? data.error
      : ''
  return serverError || couldNotUpdate(userName)
}

export const AdminUsers = () => {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const { users, loading, error, refetch } = useUsers()
  const { startImpersonation, isImpersonating } = useEffectiveUser()

  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [invitingId, setInvitingId] = useState<string | null>(null)
  const [inviteTarget, setInviteTarget] = useState<{
    id: string
    name: string
    email: string
  } | null>(null)
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')
  // Q35: a failed Publish / Featured shows in the page's red bar. Kept apart
  // from `actionError`, which belongs to the invite / delete dialogs, so one
  // error never shows twice. Cleared when the next row action starts.
  const [rowError, setRowError] = useState('')

  useEffect(() => {
    if (!actionSuccess) return
    const timer = setTimeout(() => setActionSuccess(''), 4000)
    return () => clearTimeout(timer)
  }, [actionSuccess])

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/')
    } else if (sessionStatus === 'authenticated') {
      const userType = session?.user?.userType
      if (userType !== 'admin' && userType !== 'superAdmin') {
        router.push('/')
      }
    }
  }, [sessionStatus, session, router])

  const handleAddSuccess = useCallback(() => {
    setShowAddModal(false)
    refetch()
  }, [refetch])

  const handleTogglePublished = useCallback(
    async (userId: string, currentPublished: boolean, userName: string) => {
      const newPublished = !currentPublished
      try {
        const response = await fetch(`/api/users/${userId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ published: newPublished }),
        })
        if (response.ok) {
          refetch()
        } else {
          setRowError(await rowErrorText(response, userName))
        }
      } catch (err) {
        console.error('Failed to update published status:', err)
        setRowError(couldNotUpdate(userName))
      }
    },
    [refetch],
  )

  // Was inline in the row menu; same request, same refetch, same logging.
  const handleToggleFeatured = useCallback(
    async (user: TUser) => {
      try {
        const response = await fetch(`/api/users/${user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isFeatured: !user.isFeatured }),
        })
        if (!response.ok) setRowError(await rowErrorText(response, fullName(user)))
        refetch()
      } catch (err) {
        console.error('Failed to update featured status:', err)
        setRowError(couldNotUpdate(fullName(user)))
      }
    },
    [refetch],
  )

  const handleDeleteClick = useCallback((userId: string, userName: string) => {
    setActionError('')
    setActionSuccess('')
    setDeleteTarget({ id: userId, name: userName })
  }, [])

  const handleImpersonate = useCallback(
    async (user: TUser) => {
      if (await startImpersonation(user.id)) {
        // A full load, not a client push: becoming another user must start the
        // whole page over (session, store, caches), and this admin page must
        // never re-render as "impersonating" — admin pages end impersonations.
        window.location.assign('/dashboard')
      }
    },
    [startImpersonation],
  )

  const handleInviteClick = useCallback((user: TUser) => {
    if (user.email) {
      setActionError('')
      setActionSuccess('')
      setInviteTarget({ id: user.id, name: `${user.name} ${user.lastName}`, email: user.email })
    }
  }, [])

  const handleInviteConfirm = useCallback(async () => {
    if (!inviteTarget) return
    setActionError('')
    setInvitingId(inviteTarget.id)
    try {
      const response = await fetch('/api/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: inviteTarget.id }),
      })
      if (response.ok) {
        setInviteTarget(null)
        setActionSuccess('Invite email sent successfully!')
      } else {
        const data = await response.json()
        setActionError(data.error || 'Failed to send invite')
      }
    } catch (err) {
      console.error('Invite error:', err)
      setActionError('Failed to send invite')
    } finally {
      setInvitingId(null)
    }
  }, [inviteTarget])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return
    setActionError('')
    setDeleting(true)
    try {
      const response = await fetch(`/api/users/${deleteTarget.id}`, { method: 'DELETE' })
      if (response.ok) {
        refetch()
        setDeleteTarget(null)
        setConfirmText('')
      } else {
        setActionError('Failed to delete user')
      }
    } catch (err) {
      console.error('Delete error:', err)
      setActionError('Failed to delete user')
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, refetch])

  // ── The Type filter (NEW) ──
  const searchParams = useSearchParams()
  const hasCurators = users.some((u) => u.userType === 'curator')
  const typeParam = searchParams.get('type')
  // Curators is only offered when there are curators; anything else reads as All.
  const typeFilter: TypeFilter | '' =
    typeParam === 'artists' || typeParam === 'admins' || (typeParam === 'curators' && hasCurators)
      ? typeParam
      : ''
  const setTypeFilter = useCallback(
    (type: TypeFilter | '') => {
      router.replace(type ? `${PAGE_PATH}?type=${type}` : PAGE_PATH, { scroll: false })
    },
    [router],
  )
  const typeOptions: { id: TypeFilter | 'all'; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'artists', label: 'Artists' },
    { id: 'admins', label: 'Admins' },
    ...(hasCurators ? [{ id: 'curators' as const, label: 'Curators' }] : []),
  ]
  const visibleUsers = useMemo(
    () => (typeFilter ? users.filter((u) => matchesType(u, typeFilter)) : users),
    [users, typeFilter],
  )

  // The shell shows its own loading bar first; this only covers a session that
  // is still loading under it.
  if (sessionStatus === 'loading')
    return (
      <div className={styles.page}>
        <LoadingBar />
      </div>
    )

  const userType = session?.user?.userType
  if (sessionStatus === 'unauthenticated' || (userType !== 'admin' && userType !== 'superAdmin')) {
    return <div className={styles.page}>Not authorized</div>
  }

  const isSuperAdminUser = userType === 'superAdmin'

  // ── Render-only derivations ──
  // "Loading…" only while there is nothing to show: a refetch (after every
  // action) keeps the table on screen, marked busy.
  const listed = users.length > 0
  const firstLoad = loading && !listed
  // The first read failed: the list gives way to the error.
  const loadFailed = !loading && error !== null && !listed

  return (
    <div className={styles.page}>
      <AdminPageHeader
        eyebrow="Gallery"
        title="Users"
        description="Artists, admins and curators: invite, publish, feature, impersonate."
        actions={
          <Button
            variant="bare"
            font="dashboard"
            className={styles.add}
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={16} weight="light" aria-hidden />
            Add user
          </Button>
        }
      />

      {actionSuccess && (
        <FeedbackBar tone="success" onDismiss={() => setActionSuccess('')}>
          {actionSuccess}
        </FeedbackBar>
      )}

      {rowError && (
        <FeedbackBar tone="error" onDismiss={() => setRowError('')}>
          {rowError}
        </FeedbackBar>
      )}

      {error && <Callout tone="red">{error}</Callout>}

      {!loadFailed && (
        <ListPanel
          label="Users"
          toolbar={
            listed ? (
              <div className={styles.filters}>
                <SegmentedControl
                  label="Type"
                  options={typeOptions}
                  value={typeFilter || 'all'}
                  onChange={(id) => setTypeFilter(id === 'all' ? '' : id)}
                />
              </div>
            ) : undefined
          }
          count={listed ? usersCount(visibleUsers.length) : undefined}
        >
          {firstLoad ? (
            <p className={styles.loading}>Loading…</p>
          ) : !listed ? (
            <EmptyState title="No users yet." />
          ) : visibleUsers.length === 0 ? (
            <EmptyState title="No users of this type." />
          ) : (
            <div aria-busy={loading || undefined}>
              <DataTable className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Person</th>
                    <th scope="col">Type</th>
                    <th scope="col">Profile</th>
                    <th scope="col">Featured</th>
                    <th scope="col" className={styles.actionsHead}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleUsers.map((user) => {
                    const name = fullName(user)
                    const impersonatingThis =
                      isImpersonating && session?.impersonating?.id === user.id
                    // Today's conditions, except Impersonate (Q36); a group left
                    // empty drops. Every row action first clears the row error (Q35).
                    const account: RowMenuItem[] = []
                    if (isSuperAdminUser && user.email) {
                      account.push({
                        id: 'invite',
                        label: 'Send invite…',
                        onSelect: () => {
                          setRowError('')
                          handleInviteClick(user)
                        },
                      })
                    }
                    // Q36 (owner): artist rows only, never yourself.
                    if (user.id !== session?.user?.id && user.userType === 'artist') {
                      account.push({
                        id: 'impersonate',
                        label: impersonatingThis ? 'Impersonating' : 'Impersonate',
                        disabled: impersonatingThis,
                        onSelect: () => {
                          setRowError('')
                          handleImpersonate(user)
                        },
                      })
                    }
                    const danger: RowMenuItem[] = []
                    if (isSuperAdminUser && user.id !== session?.user?.id) {
                      danger.push({
                        id: 'delete',
                        label: 'Delete user…',
                        tone: 'danger',
                        onSelect: () => {
                          setRowError('')
                          handleDeleteClick(user.id, `${user.name} ${user.lastName}`)
                        },
                      })
                    }
                    const groups: RowMenuGroup[] = [
                      { label: 'Account', items: account },
                      {
                        label: 'Profile',
                        items: [
                          {
                            id: 'publish',
                            label: user.published ? 'Unpublish' : 'Publish',
                            onSelect: () => {
                              setRowError('')
                              handleTogglePublished(user.id, user.published ?? false, name)
                            },
                          },
                          {
                            id: 'featured',
                            label: user.isFeatured ? 'Remove featured' : 'Set as featured',
                            onSelect: () => {
                              setRowError('')
                              handleToggleFeatured(user)
                            },
                          },
                        ],
                      },
                      { items: danger },
                    ]
                    return (
                      <tr key={user.id} className={styles.row}>
                        <td className={styles.cellPerson}>
                          <div className={styles.person}>
                            <span aria-hidden className={styles.avatar}>
                              {initialsOf(name)}
                            </span>
                            <span className={styles.who}>
                              <span className={styles.name}>{name}</span>
                              <span className={styles.email}>{user.email || '—'}</span>
                            </span>
                          </div>
                        </td>
                        <td className={styles.cellType}>{typeLabel(user.userType)}</td>
                        <td className={styles.cellProfile}>
                          <PublishState published={!!user.published} />
                        </td>
                        <td className={styles.cellFeatured}>
                          {user.isFeatured && (
                            <StatusPill tone="amber" shape="tag" icon={Star} label="Featured" />
                          )}
                        </td>
                        <td className={styles.cellAction}>
                          <RowMenu label={`Actions for ${name}`} width={230} groups={groups} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </DataTable>
            </div>
          )}
        </ListPanel>
      )}

      {showAddModal && (
        <AddArtistModal
          onClose={() => setShowAddModal(false)}
          onSuccess={handleAddSuccess}
          isSuperAdmin={isSuperAdminUser}
        />
      )}

      {deleteTarget && (
        <AdminConfirmModal
          title="Delete user"
          message={
            <div className={styles.form}>
              <p>
                Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This action
                cannot be undone.
              </p>
              <div className={styles.field}>
                <label htmlFor="confirm-delete-user" className={styles.fieldLabel}>
                  Type <strong>CONFIRM</strong> to enable deletion:
                </label>
                <Input
                  id="confirm-delete-user"
                  type="text"
                  size="bare"
                  inputClassName={styles.input}
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                />
              </div>
            </div>
          }
          warning={actionError || 'This action is not reversible. Please be certain.'}
          confirmLabel="Delete"
          busyLabel="Deleting…"
          destructive
          busy={deleting}
          confirmDisabled={confirmText !== 'CONFIRM'}
          onConfirm={handleDeleteConfirm}
          onCancel={() => {
            setDeleteTarget(null)
            setConfirmText('')
            setActionError('')
          }}
        />
      )}

      {inviteTarget && (
        <AdminConfirmModal
          icon={EnvelopeSimple}
          title="Send invite email"
          message={
            <>
              <p>
                Send an invitation email to <strong>{inviteTarget.name}</strong>?
              </p>
              <p>
                The email will be sent to: <strong>{inviteTarget.email}</strong>
              </p>
              {/* Q37 (owner): the invite route replaces the password. Shown always:
                  nothing this page loads says whether the user has signed in. */}
              <p>This replaces their current password with a new temporary one, sent by email.</p>
            </>
          }
          warning={actionError || undefined}
          confirmLabel="Send invite"
          busyLabel="Sending…"
          busy={invitingId === inviteTarget.id}
          onConfirm={handleInviteConfirm}
          onCancel={() => {
            setInviteTarget(null)
            setActionError('')
          }}
        />
      )}
    </div>
  )
}
