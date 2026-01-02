'use client'

import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'

import styles from './AdminDashboard.module.scss'

const contentPages = [
  { label: 'Landing Page', route: '/admin/content/landing' },
  { label: 'About Us', route: '/admin/content/about' },
  { label: 'Terms and Conditions', route: '/admin/content/terms' },
  { label: 'Privacy Policy', route: '/admin/content/privacy' },
  { label: 'Accessibility Policy', route: '/admin/content/accessibility' },
]

export const ContentManagement = () => {
  const router = useRouter()

  return (
    <div className={styles.section}>
      <Text as="h2" className={styles.sectionTitle}>
        Content Management
      </Text>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Page</th>
            <th style={{ width: 100 }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {contentPages.map((page) => (
            <tr key={page.route}>
              <td>{page.label}</td>
              <td>
                <Button
                  size="small"
                  label="Edit"
                  onClick={() => router.push(page.route)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
