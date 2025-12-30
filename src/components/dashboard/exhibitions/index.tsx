'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'

import { Button } from '@/components/ui/Button'
import { H1, P } from '@/components/ui/Typography'

import styles from './DashboardExhibitions.module.scss'

export const DashboardExhibitionsPage = () => {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <Link href="/dashboard" className={styles.backLink}>
            ← Back to Dashboard
          </Link>
          <H1 className={styles.pageTitle}>My Exhibitions</H1>
        </div>
        <div className={styles.headerActions}>
          <Button
            variant="small"
            label="+ New Exhibition"
            onClick={() => {
              /* TODO */
            }}
          />
          <Button variant="small" label="Log out" onClick={() => signOut({ callbackUrl: '/' })} />
        </div>
      </div>

      <P>Manage your current and past exhibitions</P>

      {/* Exhibition list will go here */}
      <div className={styles.exhibitionList}>
        {/* Each exhibition card would have:
            - Exhibition name
            - Status (draft, published, archived)
            - Edit button → /exhibitions/[artistSlug]/[exhibitionSlug]/edit
            - Delete button
            - View button → /exhibitions/[artistSlug]/[exhibitionSlug]
        */}
      </div>
    </div>
  )
}
