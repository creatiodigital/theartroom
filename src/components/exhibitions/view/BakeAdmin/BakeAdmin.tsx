'use client'

import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'

import styles from './BakeAdmin.module.scss'

/**
 * AR-161 — the admin's controls on the bake and review pages (`?bake=1`, `?review=1`).
 */

interface BakeActionsProps {
  /** This page in bake mode (the other query parameters kept); none: no bake button. */
  bakeHref?: string
  /** The exhibition's 3D editor. */
  editorHref: string
  bakeLabel?: string
}

/**
 * "Bake again" loads the bake page fresh — a new bake starts from a clean room, with the
 * latest saved draft — and "Back to editor".
 */
export const BakeActions = ({
  bakeHref,
  editorHref,
  bakeLabel = 'Bake again',
}: BakeActionsProps) => (
  <div className={styles.actions}>
    {bakeHref && (
      <Button
        variant="primary"
        size="smallSquared"
        label={bakeLabel}
        onClick={() => window.location.assign(bakeHref)}
      />
    )}
    <Button variant="outline" size="smallSquared" label="Back to editor" href={editorHref} />
  </div>
)

interface BakeAdminBarProps extends BakeActionsProps {
  /** Where the review stands: shown next to the actions. */
  status: string
}

/** The review page's bar: what this room is, where its review stands, and what to do next. */
export const BakeAdminBar = ({ status, ...actions }: BakeAdminBarProps) => (
  <div className={styles.bar} data-testid="bake-admin-bar">
    <div className={styles.text}>
      <Text as="p" size="sm" className={styles.title}>
        Baked room — exactly what visitors will see
      </Text>
      <Text as="p" size="xs" className={styles.status} aria-live="polite">
        {status}
      </Text>
    </div>
    <BakeActions {...actions} />
  </div>
)
