'use client'

import { useSelector } from 'react-redux'

import type { RootState } from '@/redux/store'

import styles from './Menu.module.scss'

/**
 * NEW (editor3d.md, approved): "Editing" and the exhibition's name, beside the toolbar.
 * Decorative status only: no action, not focusable. The name appears once the exhibition is in
 * the store (the editor's first render comes before `setExhibition`).
 */
export const EditingPill = () => {
  const name = useSelector((state: RootState) => state.exhibition.mainTitle)

  return (
    <p className={styles.pill}>
      <span className={styles.pillDot} aria-hidden />
      <span className={styles.pillLabel}>Editing</span>
      {name && <span className={styles.pillName}>{name}</span>}
    </p>
  )
}
