'use client'

import { useId, type KeyboardEvent, type ReactNode, type SyntheticEvent } from 'react'
import { X, type Icon } from '@phosphor-icons/react'

import { Button } from '@/components/ui/Button'

import { IconTile } from './IconTile'
import type { SaveStatus } from './saveTracking'
import type { ToolTint } from './tints'

import styles from './ToolPanel.module.scss'

/** The Save area of a panel that has Save today. */
export type ToolPanelSave = {
  saving: boolean
  /** The panel's own "Saved" moment (its `saved` state). */
  saved: boolean
  /** The panel's own save handler, unchanged. */
  onSave: () => void
  /** From `useSaveTracking`: edits since the last accepted save, and a refused last save. */
  status: SaveStatus
}

type ToolPanelProps = {
  title: string
  /** One line under the title: what the panel is for. */
  description?: ReactNode
  icon: Icon
  tint: ToolTint
  onClose: () => void
  /** Only on panels that have Save today (editor3d.md "Footer"). */
  save?: ToolPanelSave
  /** The footer of a panel without Save, e.g. the Artwork panel's "View details"; not with `save`. */
  footer?: ReactNode
  children: ReactNode
}

// A press, a drag or the wheel on a panel is the panel's: stopped here, they never reach the
// window, where the room's camera listens (as SettingsPanel did). `data-panel-overlay` is the
// marker the camera skips as well (MainCamera), as the Artwork panel had.
const keepFromRoom = (event: SyntheticEvent) => event.stopPropagation()

// Q139 (c): while a panel field has focus (a slider, a select, a color, a switch: the targets the
// camera itself calls typing, MainCamera), the walking keys are the field's. Stopped here, before
// the window, so they don't also walk the room; the field still gets them (no preventDefault).
const WALK_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'])
const FIELD = 'input, select, textarea, [contenteditable="true"]'
const keepFieldKeysFromRoom = (event: KeyboardEvent<HTMLElement>) => {
  const target = event.target as HTMLElement
  if (WALK_KEYS.has(event.key.toLowerCase()) && target.closest(FIELD)) event.stopPropagation()
}

/**
 * The floating panel a toolbar tool opens in the 3D editor (editor3d.md "Panel shell",
 * designs/editor-3d.dc.html): header with the tinted icon tile, title, purpose and close; a
 * body that scrolls; and, for the panels that save, the Save area.
 */
export function ToolPanel({
  title,
  description,
  icon,
  tint,
  onClose,
  save,
  footer,
  children,
}: ToolPanelProps) {
  const titleId = useId()
  const descriptionId = useId()

  return (
    <aside
      className={styles.panel}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      data-panel-overlay
      onMouseDown={keepFromRoom}
      onPointerDown={keepFromRoom}
      onWheel={keepFromRoom}
      onKeyDown={keepFieldKeysFromRoom}
    >
      <header className={styles.header}>
        <IconTile icon={icon} size={40} tint={tint} />
        <div className={styles.heading}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {description && (
            <p id={descriptionId} className={styles.description}>
              {description}
            </p>
          )}
        </div>
        <Button
          variant="bare"
          font="dashboard"
          className={styles.close}
          aria-label="Close panel"
          onClick={onClose}
        >
          <X size={18} weight="light" aria-hidden />
        </Button>
      </header>

      <div className={styles.body}>{children}</div>

      {save && (
        <div className={styles.footer}>
          {/* A refused save is an alert of its own, not a change of the polite status (SaveBar). */}
          {save.status.failed ? (
            <p role="alert" className={styles.failed}>
              Not saved. Please try again.
            </p>
          ) : (
            <p role="status" className={styles.status}>
              {save.status.unsaved ? (
                <>
                  <span className={styles.dot} aria-hidden />
                  Unsaved changes
                </>
              ) : (
                save.saved && <span className="sr-only">Saved</span>
              )}
            </p>
          )}
          <Button
            variant="bare"
            font="dashboard"
            className={styles.save}
            onClick={save.onSave}
            disabled={save.saving}
          >
            {save.saving ? 'Saving…' : save.saved ? 'Saved' : 'Save'}
          </Button>
        </div>
      )}

      {!save && footer && <div className={styles.footer}>{footer}</div>}
    </aside>
  )
}
