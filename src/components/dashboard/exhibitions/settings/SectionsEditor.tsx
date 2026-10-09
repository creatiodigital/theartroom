'use client'

import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { ErrorText } from '@/components/ui/ErrorText'
import { FormLabel } from '@/components/ui/FormLabel'
import { Input } from '@/components/ui/Input'
import { SECTION_TITLE_MAX } from '@/lib/exhibitionSections'
import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'

import dashboardStyles from '../../DashboardLayout/DashboardLayout.module.scss'
import styles from './SectionsEditor.module.scss'

type Section = { id: string; title: string; order: number; artworkCount: number }

async function readError(res: Response, fallback: string) {
  const data = (await res.json().catch(() => null)) as { error?: string } | null
  return data?.error || fallback
}

function SectionRow({
  section,
  onRename,
  onDelete,
}: {
  section: Section
  onRename: (id: string, title: string) => Promise<string | null>
  onDelete: (section: Section) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(section.title)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const startEditing = () => {
    setDraft(section.title)
    setError('')
    setEditing(true)
  }

  const save = async (e?: FormEvent) => {
    e?.preventDefault()
    setSaving(true)
    const message = await onRename(section.id, draft)
    setSaving(false)
    if (message) setError(message)
    else setEditing(false)
  }

  return (
    <div
      ref={setNodeRef}
      data-section-row
      data-section-id={section.id}
      className={styles.row}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <div
        className={styles.dragHandle}
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${section.title}`}
      >
        <GripVertical size={18} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
      </div>

      {editing ? (
        <form className={styles.renameForm} onSubmit={save}>
          <Input
            type="text"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setError('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditing(false)
            }}
            size="medium"
            className={styles.renameInput}
            maxLength={SECTION_TITLE_MAX}
            invalid={!!error}
            autoFocus
            aria-label="Section name"
          />
          <Button
            font="dashboard"
            variant="primary"
            label={saving ? 'Saving...' : 'Save'}
            type="submit"
            disabled={saving}
          />
          <Button
            font="dashboard"
            variant="secondary"
            label="Cancel"
            onClick={() => setEditing(false)}
            disabled={saving}
          />
          {error && <ErrorText>{error}</ErrorText>}
        </form>
      ) : (
        <>
          <span className={styles.title}>{section.title}</span>
          <span className={styles.count}>
            {section.artworkCount === 1 ? '1 artwork' : `${section.artworkCount} artworks`}
          </span>
          <Button font="dashboard" variant="secondary" label="Rename" onClick={startEditing} />
          <Button
            font="dashboard"
            variant="secondary"
            label="Delete"
            onClick={() => onDelete(section)}
          />
        </>
      )}
    </div>
  )
}

/**
 * The exhibition's page sections. Every action saves on its own — there is no
 * pending state for the page's main Save button to forget — so a section exists
 * the moment it is created and the artwork form can offer it right away.
 */
export const SectionsEditor = ({ exhibitionId }: { exhibitionId: string }) => {
  const base = `/api/exhibitions/${exhibitionId}/sections`
  const [sections, setSections] = useState<Section[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)
  const [listError, setListError] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Section | null>(null)
  const [deleting, setDeleting] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(base)
        if (cancelled) return
        if (res.ok) setSections(await res.json())
        else setListError(await readError(res, 'Failed to load sections'))
      } catch {
        if (!cancelled) setListError('Failed to load sections')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [base])

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    setAdding(true)
    try {
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      })
      if (!res.ok) {
        setAddError(await readError(res, 'Failed to add section'))
        return
      }
      const created: Section = await res.json()
      setSections((prev) => [...prev, created])
      setNewTitle('')
    } catch {
      setAddError('Failed to add section')
    } finally {
      setAdding(false)
    }
  }

  const handleRename = useCallback(
    async (id: string, title: string): Promise<string | null> => {
      try {
        const res = await fetch(`${base}/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title }),
        })
        if (!res.ok) return readError(res, 'Failed to rename section')
        const updated: Section = await res.json()
        setSections((prev) => prev.map((s) => (s.id === id ? updated : s)))
        return null
      } catch {
        return 'Failed to rename section'
      }
    },
    [base],
  )

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    const removedId = pendingDelete.id
    try {
      const res = await fetch(`${base}/${removedId}`, { method: 'DELETE' })
      if (!res.ok) setListError(await readError(res, 'Failed to delete section'))
      else setSections((prev) => prev.filter((s) => s.id !== removedId))
    } catch {
      setListError('Failed to delete section')
    } finally {
      setDeleting(false)
      setPendingDelete(null)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const previous = sections
    const oldIndex = previous.findIndex((s) => s.id === active.id)
    const newIndex = previous.findIndex((s) => s.id === over.id)
    const next = arrayMove(previous, oldIndex, newIndex)
    setSections(next)
    setListError('')

    // Snap back to what is actually saved, and say why — whether the server
    // refused the order or the request never reached it.
    try {
      const res = await fetch(`${base}/order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionIds: next.map((s) => s.id) }),
      })
      if (!res.ok) {
        setSections(previous)
        setListError(await readError(res, 'Failed to reorder sections'))
      }
    } catch {
      setSections(previous)
      setListError('Failed to reorder sections')
    }
  }

  const deleteMessage = (section: Section) =>
    section.artworkCount === 0
      ? 'It has no artworks.'
      : section.artworkCount === 1
        ? '1 artwork will move to no section. It stays on the page.'
        : `${section.artworkCount} artworks will move to no section. They stay on the page.`

  return (
    <div className={dashboardStyles.section}>
      <h3 className={dashboardStyles.sectionTitle}>Sections</h3>
      <p className={dashboardStyles.sectionDescription}>
        Optional. Split this exhibition&apos;s page into titled groups. Drag to change their order.
      </p>

      {sections.length > 0 && (
        <div className={styles.list}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sections.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {sections.map((section) => (
                <SectionRow
                  key={section.id}
                  section={section}
                  onRename={handleRename}
                  onDelete={setPendingDelete}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
      {listError && <ErrorText>{listError}</ErrorText>}

      <FormLabel htmlFor={`new-section-${exhibitionId}`}>New section name</FormLabel>
      <form className={styles.addForm} onSubmit={handleAdd}>
        <Input
          id={`new-section-${exhibitionId}`}
          type="text"
          size="medium"
          className={styles.addInput}
          value={newTitle}
          onChange={(e) => {
            setNewTitle(e.target.value)
            setAddError('')
          }}
          placeholder="e.g. Magnolia"
          maxLength={SECTION_TITLE_MAX}
          invalid={!!addError}
        />
        <Button
          font="dashboard"
          variant="secondary"
          label={adding ? 'Adding...' : 'Add section'}
          type="submit"
          disabled={adding}
        />
      </form>
      {addError && <ErrorText>{addError}</ErrorText>}

      {pendingDelete && (
        <ConfirmModal
          title={`Delete "${pendingDelete.title}"?`}
          message={deleteMessage(pendingDelete)}
          confirmLabel="Delete section"
          destructive
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
