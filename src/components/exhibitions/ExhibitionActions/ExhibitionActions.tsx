import Link from 'next/link'
import c from 'classnames'
import { ArrowRight, Box } from 'lucide-react'
import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'

import styles from './ExhibitionActions.module.scss'

interface ExhibitionActionsProps {
  /** The exhibition page. */
  href: string
  /** Straight into the 3D room, when the exhibition's space is published; else no such link. */
  visitUrl?: string | null
  className?: string
}

/**
 * "→ View Exhibition | Enter 3D Room" under an exhibition card (AR-174): the homepage grid, the
 * artist profile and the /exhibitions list. Each is a link of its own, so the card around it must
 * never be one.
 */
export const ExhibitionActions = ({ href, visitUrl, className }: ExhibitionActionsProps) => (
  <div className={c(styles.actions, className)}>
    <ArrowRight size={16} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
    <Link href={href} className={styles.action}>
      View Exhibition
    </Link>
    {visitUrl && (
      <>
        <span className={styles.separator} aria-hidden />
        <Link href={visitUrl} className={c(styles.action, styles.roomAction)}>
          <Box size={16} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
          <span>Enter 3D Room</span>
        </Link>
      </>
    )}
  </div>
)
