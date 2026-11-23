'use client'

import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DotsSixVertical, Play, Plus } from '@phosphor-icons/react'
import c from 'classnames'

import { AdminSelect } from '@/components/admin/ui/AdminSelect'
import { Callout } from '@/components/admin/ui/Callout'
import { SORTABLE_KEYBOARD_HINT } from '@/components/admin/ui/SortableList'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import Modal from '@/components/ui/Modal/Modal'
import { mediaLimitsFor, type ArtworkMediaItem } from '@/lib/artwork/artworkMediaTypes'
import {
  countObjectMedia,
  isObjectMediaRole,
  OBJECT_MEDIA_ROLE_LABEL,
  OBJECT_MEDIA_ROLES,
  objectMediaSummary,
} from '@/lib/artwork/objectArtwork'

import styles from './ObjectMediaManager.module.scss'
import { measureMedia, uploadArtworkMediaFile } from './uploadArtworkMedia'

/**
 * An Object's Photos & reels (docs/objects, objects-editor.dc.html): the ordered gallery that
 * shows the piece from every side. Each item has a label (Front, Back, Side, Detail, In a room,
 * Process, Reel) and a caption, set in a small window; drag the handle to reorder. Uploads are
 * immediate, like the image artworks' supplementary media, with the Object limits
 * (`mediaLimitsFor`): 40 photos and 6 videos; a reel (vertical) up to 60 s, a landscape video
 * up to 3 min.
 */
const ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/webm'
const ACCEPTED_TYPES = ACCEPT.split(',')
const LIMITS = mediaLimitsFor('object')
const MAX_REEL_SECONDS = 60
const MAX_VIDEO_SECONDS = 180
const EDIT_TITLE_ID = 'object-media-edit-title'

const isVertical = (item: { width?: number | null; height?: number | null }) =>
  !!item.width && !!item.height && item.height > item.width

const labelOf = (item: ArtworkMediaItem) =>
  isObjectMediaRole(item.role) ? OBJECT_MEDIA_ROLE_LABEL[item.role] : null

/** "0:24" */
const formatDuration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`

function MediaTile({
  item,
  position,
  onEdit,
}: {
  item: ArtworkMediaItem
  position: number
  onEdit: (item: ArtworkMediaItem) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })
  const [duration, setDuration] = useState<number | null>(null)
  const label = labelOf(item)
  const name = `${label ?? (item.kind === 'video' ? 'Video' : 'Photo')} ${position}`
  const reel = item.kind === 'video' && (item.role === 'reel' || isVertical(item))

  return (
    <li
      ref={setNodeRef}
      className={styles.item}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <figure className={styles.figure}>
        <span className={c(styles.tile, reel && styles.reel)}>
          <Button
            variant="bare"
            font="dashboard"
            className={styles.open}
            aria-label={`Edit ${name}`}
            onClick={() => onEdit(item)}
          >
            {item.kind === 'video' ? (
              <video
                src={item.url}
                className={styles.media}
                muted
                playsInline
                preload="metadata"
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              />
            ) : (
              <img src={item.url} alt="" className={styles.media} />
            )}
          </Button>
          {label && <span className={styles.role}>{label}</span>}
          {item.kind === 'video' && (
            <>
              <span aria-hidden className={styles.play}>
                <Play size={12} weight="fill" />
              </span>
              {duration !== null && Number.isFinite(duration) && (
                <span className={styles.duration}>{formatDuration(duration)}</span>
              )}
            </>
          )}
          {/* dnd-kit's own handle (role="button", tabIndex 0): Space picks it up. */}
          <span
            className={styles.handle}
            {...attributes}
            {...listeners}
            aria-label={`Reorder ${name}`}
          >
            <DotsSixVertical size={16} weight="bold" aria-hidden />
          </span>
        </span>
        {item.caption && <figcaption className={styles.caption}>{item.caption}</figcaption>}
      </figure>
    </li>
  )
}

export const ObjectMediaManager = ({ artworkId }: { artworkId: string }) => {
  const [media, setMedia] = useState<ArtworkMediaItem[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [editing, setEditing] = useState<ArtworkMediaItem | null>(null)
  const [editRole, setEditRole] = useState('')
  const [editCaption, setEditCaption] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const load = useCallback(async () => {
    const res = await fetch(`/api/artwork-media?artworkId=${artworkId}`)
    if (res.ok) setMedia((await res.json()).media)
  }, [artworkId])

  useEffect(() => {
    void load()
  }, [load])

  const counts = countObjectMedia(media)
  const videoCount = counts.videos + counts.reels
  const full = counts.photos >= LIMITS.maxImages && videoCount >= LIMITS.maxVideos

  const upload = async (files: File[]) => {
    setBusy(true)
    setError(null)
    let photos = counts.photos
    let videos = videoCount
    const refused: string[] = []

    for (const file of files) {
      const isVideo = file.type.startsWith('video/')
      if (isVideo ? videos >= LIMITS.maxVideos : photos >= LIMITS.maxImages) {
        refused.push(
          `${file.name}: at most ${isVideo ? `${LIMITS.maxVideos} videos` : `${LIMITS.maxImages} photos`}`,
        )
        continue
      }
      const { width, height, duration } = await measureMedia(file)
      const vertical = isVertical({ width, height })
      if (isVideo && duration !== undefined) {
        const max = vertical ? MAX_REEL_SECONDS : MAX_VIDEO_SECONDS
        if (duration > max + 0.5) {
          refused.push(
            `${file.name}: ${vertical ? 'a reel can be up to 60 s' : 'a landscape video can be up to 3 min'}`,
          )
          continue
        }
      }
      try {
        // A vertical video is a reel; the artist labels the rest.
        await uploadArtworkMediaFile({
          artworkId,
          file,
          width,
          height,
          role: isVideo && vertical ? 'reel' : null,
        })
        if (isVideo) videos += 1
        else photos += 1
      } catch (e) {
        refused.push(`${file.name}: ${e instanceof Error ? e.message : 'upload failed'}`)
      }
    }

    if (refused.length > 0) setError(`Not added: ${refused.join('; ')}.`)
    await load()
    setBusy(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = media.findIndex((m) => m.id === active.id)
    const to = media.findIndex((m) => m.id === over.id)
    if (from === -1 || to === -1) return
    const next = arrayMove(media, from, to)
    setMedia(next)
    const res = await fetch('/api/artwork-media', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artworkId, order: next.map((m) => m.id) }),
    })
    if (!res.ok) {
      setError("Couldn't save the new order. Please try again.")
      await load()
    }
  }

  const openEditor = (item: ArtworkMediaItem) => {
    setEditing(item)
    setEditRole(isObjectMediaRole(item.role) ? item.role : '')
    setEditCaption(item.caption ?? '')
    setEditError(null)
  }

  const saveEdit = async () => {
    if (!editing) return
    setBusy(true)
    const res = await fetch('/api/artwork-media', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editing.id, role: editRole || null, caption: editCaption }),
    })
    setBusy(false)
    if (!res.ok) {
      setEditError((await res.json().catch(() => ({}))).error ?? 'Could not save that change')
      return
    }
    setEditing(null)
    await load()
  }

  const removeEditing = async () => {
    if (!editing) return
    setBusy(true)
    // The row id, never a key or a URL: the server resolves the object from its own row.
    const res = await fetch('/api/artwork-media', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editing.id }),
    })
    setBusy(false)
    if (!res.ok) {
      setEditError((await res.json().catch(() => ({}))).error ?? 'Could not remove that file')
      return
    }
    setEditing(null)
    await load()
  }

  const canDrop = !busy && !full
  const onDragOver = (event: DragEvent<HTMLElement>) => {
    if (!canDrop || !event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    setDragging(true)
  }
  const onDrop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    setDragging(false)
    if (!canDrop) return
    const files = Array.from(event.dataTransfer.files)
    const accepted = files.filter((file) => ACCEPTED_TYPES.includes(file.type))
    const other = files.filter((file) => !ACCEPTED_TYPES.includes(file.type))
    if (accepted.length > 0) await upload(accepted)
    if (other.length > 0) {
      const line = `Not added: ${other.map((file) => file.name).join(', ')} (JPG, PNG, WebP, MP4 or WebM only).`
      setError((prev) => (prev ? `${prev} ${line}` : line))
    }
  }

  const summary = objectMediaSummary(counts)
  const roleOptions = OBJECT_MEDIA_ROLES.filter(
    (role) => role !== 'reel' || editing?.kind === 'video',
  )

  return (
    <div className={styles.manager}>
      <p className={styles.count}>
        {summary ? `${summary} · ` : ''}up to {LIMITS.maxImages} photos and {LIMITS.maxVideos}{' '}
        videos
      </p>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className={styles.input}
        tabIndex={-1}
        onChange={(e) => e.target.files?.length && upload(Array.from(e.target.files))}
      />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={media.map((m) => m.id)} strategy={rectSortingStrategy}>
          <ul className={styles.grid}>
            {media.map((item, i) => (
              <MediaTile key={item.id} item={item} position={i + 1} onEdit={openEditor} />
            ))}
            {/* The add tile also takes dropped files: the same upload, after the picker's types. */}
            <li
              className={styles.item}
              onDragOver={onDragOver}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
              }}
              onDrop={onDrop}
            >
              <Button
                variant="bare"
                font="dashboard"
                className={c(styles.add, dragging && styles.addActive)}
                disabled={busy || full}
                onClick={() => inputRef.current?.click()}
              >
                <Plus size={22} weight="light" aria-hidden />
                <strong>{busy ? 'Uploading…' : 'Add photos or videos'}</strong>
                <span>{full ? 'Limit reached' : 'or drop them here'}</span>
              </Button>
            </li>
          </ul>
        </SortableContext>
      </DndContext>
      {media.length > 1 && <p className={styles.hint}>{SORTABLE_KEYBOARD_HINT}</p>}

      <div className={styles.note}>
        <span>
          <strong>Label each one</strong> (Front, Back, Side, Detail, In a room, Process). Labels
          help visitors and screen readers.
        </span>
        <span>
          <strong>Reels</strong>: vertical 9:16 videos up to 60 s play silently as they scroll by.
          Landscape videos up to 3 min.
        </span>
      </div>

      {error && (
        <Callout tone="red" role="alert">
          {error}
        </Callout>
      )}

      {editing && (
        <Modal tone="admin" titleId={EDIT_TITLE_ID} onClose={() => setEditing(null)} showClose>
          <div className={styles.dialog}>
            <h2 id={EDIT_TITLE_ID} className={styles.dialogTitle}>
              {editing.kind === 'video' ? 'Video' : 'Photo'}
            </h2>
            <span
              className={c(
                styles.dialogPreview,
                editing.kind === 'video' && isVertical(editing) && styles.reel,
              )}
            >
              {editing.kind === 'video' ? (
                <video src={editing.url} className={styles.media} controls playsInline />
              ) : (
                <img src={editing.url} alt="" className={styles.media} />
              )}
            </span>
            <AdminSelect
              id="object-media-role"
              label="Label"
              size="form"
              value={editRole}
              onChange={setEditRole}
            >
              <option value="">No label</option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {OBJECT_MEDIA_ROLE_LABEL[role]}
                </option>
              ))}
            </AdminSelect>
            <div className={styles.field}>
              <label htmlFor="object-media-caption" className={styles.label}>
                Caption
              </label>
              <Input
                id="object-media-caption"
                type="text"
                size="bare"
                inputClassName={styles.textInput}
                value={editCaption}
                maxLength={300}
                onChange={(e) => setEditCaption(e.target.value)}
              />
              <span className={styles.help}>One line under it on the artwork page.</span>
            </div>
            {editError && (
              <Callout tone="red" role="alert">
                {editError}
              </Callout>
            )}
            <div className={styles.dialogActions}>
              <Button
                variant="bare"
                font="dashboard"
                className={styles.remove}
                disabled={busy}
                onClick={removeEditing}
              >
                Remove
              </Button>
              <Button
                variant="bare"
                font="dashboard"
                className={styles.secondary}
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
              <Button
                variant="bare"
                font="dashboard"
                className={styles.primary}
                disabled={busy}
                onClick={saveEdit}
              >
                Save
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
