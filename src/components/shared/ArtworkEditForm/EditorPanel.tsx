'use client'

import type { ReactNode } from 'react'

import { panelDescriptionId, panelTitleId, type ArtworkSection } from './sections'

import styles from './EditorPanel.module.scss'

type EditorPanelProps = {
  section: ArtworkSection
  /** One line under the title (the section's own description). */
  description?: ReactNode
  /** Right of the title and its line, e.g. the Print sales switch or Ready to sell's button. */
  aside?: ReactNode
  children?: ReactNode
}

/**
 * One section of the artwork editor as a white panel (artist.md §3,
 * designs/artist-artwork-edit.dc.html): h2 18/700, an optional line under it,
 * an optional control on the right, then the section's fields. Its id is the
 * On this page anchor.
 */
export function EditorPanel({ section, description, aside, children }: EditorPanelProps) {
  return (
    <section id={section.id} aria-labelledby={panelTitleId(section)} className={styles.panel}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <h2 id={panelTitleId(section)} className={styles.title}>
            {section.title}
          </h2>
          {description && (
            <p id={panelDescriptionId(section)} className={styles.description}>
              {description}
            </p>
          )}
        </div>
        {aside && <div className={styles.aside}>{aside}</div>}
      </div>
      {children}
    </section>
  )
}
