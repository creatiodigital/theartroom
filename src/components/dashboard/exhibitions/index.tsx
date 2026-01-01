'use client'

import Link from 'next/link'


import { Button } from '@/components/ui/Button'
import { Logout } from '@/components/ui/Logout'
import { Text } from '@/components/ui/Typography'

import styles from './DashboardExhibitions.module.scss'

export const DashboardExhibitionsPage = () => {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <Link href="/dashboard" className={styles.backLink}>
            ← Back to Dashboard
          </Link>
          <Text as="h1" className={styles.pageTitle}>
            My Exhibitions
          </Text>
        </div>
        <div className={styles.headerActions}>
          <Button
            size="small"
            label="+ New Exhibition"
            onClick={() => {
              /* TODO */
            }}
          />
          <Logout />
        </div>
      </div>

      <Text as="p">Manage your current and past exhibitions</Text>

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
