'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SignOut } from '@phosphor-icons/react'
import c from 'classnames'

import { AdminNavItem, navItemClassName } from '@/components/admin/shell/AdminNavItem'
import { initialsOf } from '@/components/admin/ui/initials'
import { Button } from '@/components/ui/Button'
import { signOutAndVerify } from '@/lib/auth/signOutAndVerify'

import { ImpersonationCard } from './ImpersonationCard'
import { CHANGE_PASSWORD_ITEM, STUDIO_NAV_ITEMS, isStudioItemActive } from './studioNav'
import { useStudioImpersonation, useStudioPerson } from './useStudioShell'

import styles from './StudioMenuBody.module.scss'

type StudioMenuBodyProps = {
  /** `sidebar` = the side menu; `drawer` = the phone drawer (48px rows). */
  layout: 'sidebar' | 'drawer'
  /** The drawer closes itself on any item. */
  onNavigate?: () => void
}

/**
 * Everything under the brand, shared by the side menu and the drawer: the
 * impersonation card, the four items, and the foot (who, the public page,
 * Change password, Log out). artist-home.dc.html.
 */
export function StudioMenuBody({ layout, onNavigate }: StudioMenuBodyProps) {
  const pathname = usePathname() ?? ''
  const impersonation = useStudioImpersonation()
  const person = useStudioPerson()
  const size = layout === 'drawer' ? 'drawer' : 'menu'

  return (
    <>
      {impersonation && (
        <ImpersonationCard
          name={impersonation.name}
          onStop={() => void impersonation.stop()}
          layout={layout}
        />
      )}

      <div className={styles.group}>
        {STUDIO_NAV_ITEMS.map((item) => (
          <AdminNavItem
            key={item.href}
            item={item}
            tone="light"
            size={size}
            active={isStudioItemActive(pathname, item.href)}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      <div className={c(styles.foot, styles[layout])}>
        <div className={styles.person}>
          {person.imageUrl ? (
            <Image
              src={person.imageUrl}
              alt=""
              width={32}
              height={32}
              sizes="32px"
              unoptimized
              className={styles.avatar}
            />
          ) : (
            <span aria-hidden className={c(styles.avatar, styles.initials)}>
              {initialsOf(person.name)}
            </span>
          )}
          <span className={styles.who}>
            <span className={styles.name}>{person.name}</span>
            {person.publicHref && (
              <Link
                href={person.publicHref}
                target="_blank"
                rel="noopener noreferrer"
                prefetch={false}
                className={styles.publicLink}
              >
                View my public page<span aria-hidden> ↗</span>
                <span className="sr-only"> (opens in a new tab)</span>
              </Link>
            )}
          </span>
        </div>

        <AdminNavItem
          item={CHANGE_PASSWORD_ITEM}
          tone="light"
          size={size}
          active={isStudioItemActive(pathname, CHANGE_PASSWORD_ITEM.href)}
          onNavigate={onNavigate}
        />

        <Button
          variant="bare"
          font="dashboard"
          className={c(
            navItemClassName({ tone: 'light', size, compact: true, active: false }),
            styles.action,
          )}
          onClick={() => void signOutAndVerify()}
        >
          <SignOut size={size === 'drawer' ? 18 : 16} weight="light" aria-hidden />
          <span>Log out</span>
        </Button>
      </div>
    </>
  )
}
