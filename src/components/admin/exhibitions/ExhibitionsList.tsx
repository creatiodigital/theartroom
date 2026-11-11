'use client'

import { Fragment, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Cube } from '@phosphor-icons/react'
import c from 'classnames'

import { AdminConfirmModal } from '@/components/admin/ui/AdminConfirmModal'
import { AdminPageHeader } from '@/components/admin/ui/AdminPageHeader'
import { Callout } from '@/components/admin/ui/Callout'
import { DataTable } from '@/components/admin/ui/DataTable'
import { EmptyState } from '@/components/admin/ui/EmptyState'
import { ListPanel } from '@/components/admin/ui/ListPanel'
import { PublishState } from '@/components/admin/ui/PublishState'
import { RowMenu, type RowMenuGroup, type RowMenuItem } from '@/components/admin/ui/RowMenu'
import { StatusPill } from '@/components/admin/ui/StatusPill'
import { spaceConfigs, type SpaceKey } from '@/components/scene/constants'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { isBakedSpace } from '@/lib/bake/bakedSpaces'
import { BAKE_GATE_MESSAGES, isBakeGateError } from '@/lib/bake/publishGate'
import type { BakeGateError } from '@/lib/bake/publishGate'

import styles from './Exhibitions.module.scss'

type Exhibition = {
  id: string
  mainTitle: string
  url: string
  handler: string
  spaceId: string
  status: string
  published: boolean
  spacePublished: boolean
  hasPendingChanges: boolean
  previewEnabled: boolean
  previewToken: string | null
  // Count of ExhibitionArtwork rows with a wallId — how many works are
  // actually hung in the 3D room, independent of page membership.
  hasPlacedArtworks: number
  user: {
    id: string
    name: string
    lastName: string
    handler: string
    published?: boolean
  }
}

/** Status (exhibitions.md): the stored value with its first letter capitalized. */
const statusLabel = (status: string) => status.charAt(0).toUpperCase() + status.slice(1)

const statusTone = (status: string) =>
  status === 'current'
    ? 'green'
    : status === 'past'
      ? 'gray'
      : status === 'draft'
        ? 'outline'
        : 'info'

const exhibitionsCount = (n: number) => `${n} ${n === 1 ? 'exhibition' : 'exhibitions'}`

export const ExhibitionsList = () => {
  const router = useRouter()
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<Exhibition | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [confirmText, setConfirmText] = useState('')
  // Publishes the server refused (a baked room needs a current, reviewed bake), by
  // exhibition id: explained on the row until an action on it goes through.
  const [refusals, setRefusals] = useState<Record<string, BakeGateError>>({})

  const fetchExhibitions = useCallback(async () => {
    try {
      const response = await fetch('/api/exhibitions')
      if (response.ok) {
        const data = await response.json()
        setExhibitions(data)
      }
    } catch (error) {
      console.error('Failed to fetch exhibitions:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchExhibitions()
  }, [fetchExhibitions])

  const noteRefusal = async (exhibitionId: string, response: Response) => {
    let refusal: BakeGateError | null = null
    if (response.status === 409) {
      const data = await response.json().catch(() => null)
      if (isBakeGateError(data?.error)) refusal = data.error
    }
    if (!refusal && !response.ok) return
    setRefusals(({ [exhibitionId]: _previous, ...others }) =>
      refusal ? { ...others, [exhibitionId]: refusal } : others,
    )
  }

  const handleToggleStatus = async (exhibitionId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'current' ? 'past' : 'current'
    try {
      const response = await fetch(`/api/exhibitions/${exhibitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (response.ok) {
        fetchExhibitions()
      }
    } catch (error) {
      console.error('Failed to update status:', error)
    }
  }

  const handlePublishAction = async (exhibitionId: string, action: 'publish' | 'unpublish') => {
    try {
      const response = await fetch(`/api/exhibitions/${exhibitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: action === 'publish' }),
      })
      await noteRefusal(exhibitionId, response)
      if (response.ok) {
        fetchExhibitions()
      }
    } catch (error) {
      console.error('Failed to update published status:', error)
    }
  }

  // Independent of handlePublishAction: `spacePublished` gates only the 3D
  // room (the Enter button + the scene API), never the exhibition page
  // itself. Disabled in the menu below while the exhibition is unpublished —
  // there is no room to switch on for a show that isn't live.
  const handleSpacePublishAction = async (
    exhibitionId: string,
    action: 'publish' | 'unpublish',
  ) => {
    try {
      const response = await fetch(`/api/exhibitions/${exhibitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spacePublished: action === 'publish' }),
      })
      await noteRefusal(exhibitionId, response)
      if (response.ok) {
        fetchExhibitions()
      }
    } catch (error) {
      console.error('Failed to update 3D space published status:', error)
    }
  }

  const handleUpdatePreviewExhibition = async (exhibitionId: string) => {
    try {
      const response = await fetch(`/api/exhibitions/${exhibitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hasPendingChanges: false }),
      })
      await noteRefusal(exhibitionId, response)
      if (response.ok) {
        fetchExhibitions()
      }
    } catch (error) {
      console.error('Failed to update preview exhibition:', error)
    }
  }

  const handleTogglePreview = async (exhibitionId: string, currentlyEnabled: boolean) => {
    try {
      const response = await fetch(`/api/exhibitions/${exhibitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ previewEnabled: !currentlyEnabled }),
      })
      if (response.ok) {
        fetchExhibitions()
      }
    } catch (error) {
      console.error('Failed to toggle preview:', error)
    }
  }

  const handleCopyPreviewLink = (exhibition: Exhibition) => {
    const baseUrl = window.location.origin
    const visitUrl = `${baseUrl}/exhibitions/${exhibition.user.handler}/${exhibition.url}/visit?preview=${exhibition.previewToken}`
    navigator.clipboard.writeText(visitUrl)
  }

  const handleUpdatePreviewLink = async (exhibitionId: string) => {
    try {
      // Re-enable preview to generate a new token (old link becomes invalid)
      const response = await fetch(`/api/exhibitions/${exhibitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ previewEnabled: true }),
      })
      if (response.ok) {
        fetchExhibitions()
      }
    } catch (error) {
      console.error('Failed to update preview link:', error)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return

    setDeleting(true)
    setDeleteError('')
    try {
      const response = await fetch(`/api/exhibitions/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        fetchExhibitions()
        setDeleteTarget(null)
        setConfirmText('')
      } else {
        const data = await response.json()
        setDeleteError(data.error || 'Failed to delete exhibition')
      }
    } catch (error) {
      console.error('Failed to delete exhibition:', error)
      setDeleteError('Failed to delete exhibition')
    } finally {
      setDeleting(false)
    }
  }

  // ── Render-only derivations ──
  const listed = exhibitions.length > 0

  return (
    <div className={styles.page}>
      <AdminPageHeader
        eyebrow="Gallery"
        title="Exhibitions"
        description="Exhibition pages, their 3D rooms and preview links."
      />

      <ListPanel
        label="Exhibitions"
        count={listed ? exhibitionsCount(exhibitions.length) : undefined}
      >
        {loading ? (
          <p className={styles.loading}>Loading exhibitions…</p>
        ) : !listed ? (
          <EmptyState title="No exhibitions yet." />
        ) : (
          <DataTable className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Exhibition</th>
                <th scope="col">Status</th>
                <th scope="col">On the site</th>
                <th scope="col">Preview link</th>
                <th scope="col">Changes</th>
                <th scope="col" className={styles.actionsHead}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {exhibitions.map((exhibition) => {
                const baked = isBakedSpace(exhibition.spaceId)
                const editorHref = `/exhibitions/${exhibition.user.handler}/${exhibition.url}/edit`
                const artist = `${exhibition.user.name} ${exhibition.user.lastName}`.trim()
                const space =
                  spaceConfigs[exhibition.spaceId as SpaceKey]?.displayName || exhibition.spaceId
                const previewActive = (!exhibition.published || baked) && exhibition.previewEnabled
                const reviewShown = exhibition.published || exhibition.previewEnabled
                const refusal = refusals[exhibition.id]

                // Today's menu items, conditions and handlers, in the spec's groups
                // (exhibitions.md); a group left empty drops.
                const exhibitionItems: RowMenuItem[] = []
                // Publish / Update exhibition
                if (!exhibition.published || exhibition.hasPendingChanges) {
                  exhibitionItems.push({
                    id: 'publish',
                    label: exhibition.hasPendingChanges
                      ? 'Update exhibition'
                      : 'Publish exhibition',
                    // Q40: only where the update publishes; on an unpublished
                    // exhibition it refreshes the preview instead.
                    hint:
                      exhibition.published && exhibition.hasPendingChanges
                        ? 'Publish the pending changes'
                        : undefined,
                    disabled:
                      !exhibition.published &&
                      !exhibition.previewEnabled &&
                      !exhibition.user.published,
                    onSelect: () => {
                      if (exhibition.hasPendingChanges && !exhibition.published) {
                        handleUpdatePreviewExhibition(exhibition.id)
                      } else {
                        handlePublishAction(exhibition.id, 'publish')
                      }
                    },
                  })
                }
                // Unpublish — always available when published. Label is explicit
                // ("exhibition") so it's never mistaken for the 3D-only control: this
                // one takes the whole show off the site.
                if (exhibition.published) {
                  exhibitionItems.push({
                    id: 'unpublish',
                    label: 'Unpublish exhibition',
                    onSelect: () => handlePublishAction(exhibition.id, 'unpublish'),
                  })
                }
                exhibitionItems.push({
                  id: 'status',
                  label: exhibition.status === 'current' ? 'Mark past' : 'Mark current',
                  onSelect: () => handleToggleStatus(exhibition.id, exhibition.status),
                })

                // Publish / Unpublish 3D space — independent of the exhibition-wide
                // toggle. Disabled while the exhibition itself is unpublished: there
                // is no live show to attach a room to yet.
                const roomItems: RowMenuItem[] = [
                  {
                    id: 'space',
                    label: exhibition.spacePublished ? 'Unpublish 3D space' : 'Publish 3D space',
                    hint: !exhibition.published ? 'Publish the exhibition first' : undefined,
                    disabled: !exhibition.published,
                    onSelect: () =>
                      handleSpacePublishAction(
                        exhibition.id,
                        exhibition.spacePublished ? 'unpublish' : 'publish',
                      ),
                  },
                  // The same editor link as the refusal notice (exhibitions.md).
                  {
                    id: 'editor',
                    label: 'Open 3D editor',
                    onSelect: () => router.push(editorHref),
                  },
                ]

                // Preview: unpublished exhibitions; in a baked space (AR-161) the same
                // switch is the bake preview link, available for live exhibitions too.
                const previewItems: RowMenuItem[] = []
                if (!exhibition.published || baked) {
                  previewItems.push({
                    id: 'preview',
                    label: baked
                      ? exhibition.previewEnabled
                        ? 'Disable bake preview link'
                        : 'Enable bake preview link'
                      : exhibition.previewEnabled
                        ? 'Unpublish preview'
                        : 'Publish preview',
                    onSelect: () => handleTogglePreview(exhibition.id, exhibition.previewEnabled),
                  })
                }
                // Copy Preview Link — only when preview is active
                if (
                  (!exhibition.published || baked) &&
                  exhibition.previewEnabled &&
                  exhibition.previewToken
                ) {
                  previewItems.push({
                    id: 'copy',
                    label: baked ? 'Copy bake preview link' : 'Copy preview link',
                    onSelect: () => handleCopyPreviewLink(exhibition),
                  })
                }
                // Update Preview Link — regenerate token (old link becomes invalid)
                if (
                  (!exhibition.published || baked) &&
                  exhibition.previewEnabled &&
                  exhibition.previewToken
                ) {
                  previewItems.push({
                    id: 'update-link',
                    label: 'Update preview link',
                    onSelect: () => handleUpdatePreviewLink(exhibition.id),
                  })
                }
                // View baked room (AR-161) — the draft bake exactly as visitors will
                // get it; looking at it is what marks it reviewed.
                if (baked) {
                  previewItems.push({
                    id: 'review',
                    label: 'View baked room',
                    onSelect: () =>
                      router.push(
                        `/exhibitions/${exhibition.user.handler}/${exhibition.url}/visit?review=1`,
                      ),
                  })
                }

                const groups: RowMenuGroup[] = [
                  { label: 'Exhibition', items: exhibitionItems },
                  { label: '3D room', items: roomItems },
                  { label: 'Preview', items: previewItems },
                  {
                    items: [
                      {
                        id: 'delete',
                        label: 'Delete exhibition…',
                        tone: 'danger',
                        onSelect: () => {
                          setDeleteError('')
                          setDeleteTarget(exhibition)
                        },
                      },
                    ],
                  },
                ]

                return (
                  <Fragment key={exhibition.id}>
                    <tr className={styles.row}>
                      <td className={styles.cellExhibition}>
                        <Link
                          href={`/exhibitions/${exhibition.user.handler}/${exhibition.url}`}
                          className={styles.title}
                        >
                          {exhibition.mainTitle}
                        </Link>
                        <span className={styles.meta}>
                          {artist} · {space}
                        </span>
                      </td>
                      <td className={styles.cellStatus}>
                        {exhibition.status && (
                          <StatusPill
                            shape="tag"
                            tone={statusTone(exhibition.status)}
                            label={statusLabel(exhibition.status)}
                          />
                        )}
                      </td>
                      <td className={styles.cellSite}>
                        <PublishState published={exhibition.published} />
                        {/* Switching the room on is the norm; leaving it off is the
                          exception. So the likelier mistake is finishing a room and
                          forgetting to reveal it. The marker appears in that one state
                          and no other. */}
                        {exhibition.published &&
                        exhibition.hasPlacedArtworks > 0 &&
                        !exhibition.spacePublished ? (
                          <span className={styles.ready}>
                            <Cube size={14} weight="light" aria-hidden />
                            3D room ready, not switched on
                          </span>
                        ) : exhibition.spacePublished ? (
                          <span className={styles.roomOn}>3D room on</span>
                        ) : null}
                      </td>
                      <td className={c(styles.cellPreview, !previewActive && styles.none)}>
                        {previewActive ? (
                          <>
                            <span className={styles.phoneLabel}>Preview link</span>
                            <StatusPill tone="info" shape="tag" label="Active" />
                          </>
                        ) : (
                          <span className={styles.dash}>—</span>
                        )}
                      </td>
                      <td className={c(styles.cellChanges, !reviewShown && styles.none)}>
                        {reviewShown ? (
                          exhibition.hasPendingChanges ? (
                            <StatusPill tone="amber" shape="tag" label="Needs review" />
                          ) : (
                            <StatusPill tone="green" shape="tag" label="Up to date" />
                          )
                        ) : (
                          <span className={styles.dash}>—</span>
                        )}
                      </td>
                      <td className={styles.cellAction}>
                        <RowMenu
                          label={`Actions for ${exhibition.mainTitle}`}
                          width={264}
                          groups={groups}
                        />
                      </td>
                    </tr>
                    {/* Why the server refused a publish (AR-161), under the whole row
                      and with the way to fix it — not squeezed into the actions column. */}
                    {refusal && (
                      <tr className={styles.refusalRow}>
                        <td colSpan={6}>
                          <Callout
                            tone="amber"
                            role="alert"
                            action={
                              <Button
                                variant="secondary"
                                font="dashboard"
                                className={styles.editorLink}
                                href={editorHref}
                                label="Open 3D editor"
                              />
                            }
                          >
                            {BAKE_GATE_MESSAGES[refusal]}
                          </Callout>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </DataTable>
        )}
      </ListPanel>

      {deleteTarget && (
        <AdminConfirmModal
          title="Delete exhibition"
          message={
            <div className={styles.form}>
              <p>
                Are you sure you want to delete <strong>{deleteTarget.mainTitle}</strong> by{' '}
                {deleteTarget.user.name} {deleteTarget.user.lastName}?
              </p>
              <div className={styles.field}>
                <label htmlFor="confirm-delete" className={styles.fieldLabel}>
                  Type <strong>CONFIRM</strong> to enable deletion:
                </label>
                <Input
                  id="confirm-delete"
                  type="text"
                  size="bare"
                  inputClassName={styles.input}
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                />
              </div>
            </div>
          }
          warning={deleteError || 'This action is not reversible. Please be certain.'}
          confirmLabel="Delete"
          busyLabel="Deleting…"
          destructive
          busy={deleting}
          confirmDisabled={confirmText !== 'CONFIRM'}
          onConfirm={handleDeleteConfirm}
          onCancel={() => {
            setDeleteTarget(null)
            setConfirmText('')
            setDeleteError('')
          }}
        />
      )}
    </div>
  )
}
