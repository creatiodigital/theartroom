'use client'

import type { ReactNode } from 'react'
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
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DotsSixVertical } from '@phosphor-icons/react'
import c from 'classnames'

import styles from './SortableList.module.scss'

export type SortableListRow = {
  /** The dnd-kit id (e.g. a slide's id, a selection entry's id). */
  id: string
  /** The row's 600 line, and the handle's name: "Reorder {title}". */
  title: string
  /** 13px secondary, under the title (may hold several lines). */
  sub?: ReactNode
  /** The page's sized image or empty tile. */
  thumb: ReactNode
  actions: ReactNode
  className?: string
  /** An empty attribute on the row, e.g. `data-selection-row` (an e2e hook). */
  marker?: `data-${string}`
}

type SortableListProps = {
  rows: SortableListRow[]
  /** The page's own drop handler. */
  onDragEnd: (event: DragEndEvent) => void
}

/** The footnote under a sortable list (gallery.md §2a). */
export const SORTABLE_KEYBOARD_HINT =
  'Keyboard: focus the handle, press Space, move with the arrow keys, Space again to drop.'

function SortableRow({ row, position }: { row: SortableListRow; position: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  })

  return (
    <li
      ref={setNodeRef}
      {...(row.marker ? { [row.marker]: '' } : {})}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className={c(styles.row, row.className)}
    >
      {/* dnd-kit's own handle (role="button", tabIndex 0, its listeners): the
          keyboard sensor picks it up with Space or Enter. */}
      <div
        className={styles.handle}
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${row.title}`}
      >
        <DotsSixVertical size={18} weight="bold" aria-hidden />
      </div>
      <span className={styles.position}>{position}</span>
      <div className={styles.thumb}>{row.thumb}</div>
      <div className={styles.text}>
        <span className={styles.title}>{row.title}</span>
        {row.sub && <div className={styles.sub}>{row.sub}</div>}
      </div>
      <div className={styles.actions}>{row.actions}</div>
    </li>
  )
}

/**
 * A drag-to-reorder list (gallery.md §2a, designs/content-slideshow.dc.html):
 * handle, position, thumbnail, title + sub line, actions. The sensors, the
 * collision rule, the strategy and the dragged row's style are the ones the
 * landing slideshow and the gallery selection each had; the page keeps its
 * own drop handler and request.
 */
export function SortableList({ rows, onDragEnd }: SortableListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
        <ol className={styles.list}>
          {rows.map((row, i) => (
            <SortableRow key={row.id} row={row} position={i + 1} />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  )
}
