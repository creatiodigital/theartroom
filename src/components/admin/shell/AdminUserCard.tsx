'use client'

import { useSession } from 'next-auth/react'
import { SignOut } from '@phosphor-icons/react'
import c from 'classnames'

import { initialsOf } from '@/components/admin/ui/initials'
import { Button } from '@/components/ui/Button'
import { signOutAndVerify } from '@/lib/auth/signOutAndVerify'

import styles from './AdminUserCard.module.scss'

type AdminUserCardProps = {
  /** `sidebar` = raised card with an icon button; `drawer` = row with a "Log out" text button. */
  layout: 'sidebar' | 'drawer'
}

export function AdminUserCard({ layout }: AdminUserCardProps) {
  const { data: session } = useSession()
  const name = session?.user?.name?.trim() || session?.user?.email || 'Admin'
  const role = session?.user?.userType === 'superAdmin' ? 'Super Admin' : 'Admin'

  return (
    <div className={c(styles.card, styles[layout])}>
      <div aria-hidden className={styles.avatar}>
        {initialsOf(name)}
      </div>
      <div className={styles.who}>
        <span className={styles.name}>{name}</span>
        <span className={styles.role}>{role}</span>
      </div>
      {layout === 'sidebar' ? (
        <Button
          variant="bare"
          font="dashboard"
          className={styles.iconButton}
          aria-label="Log out"
          onClick={() => void signOutAndVerify()}
        >
          <SignOut size={16} weight="light" aria-hidden />
        </Button>
      ) : (
        <Button
          variant="bare"
          font="dashboard"
          className={styles.textButton}
          label="Log out"
          onClick={() => void signOutAndVerify()}
        />
      )}
    </div>
  )
}
