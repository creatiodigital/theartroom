'use client'

import { useRouter } from 'next/navigation'

import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'
import { Button } from '@/components/ui/Button'

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
    <div className={dashboardStyles.section}>
      <div className={dashboardStyles.sectionHeader}>
        <h2 className={dashboardStyles.sectionTitle}>Content Management</h2>
      </div>

      <table className={dashboardStyles.table}>
        <thead>
          <tr>
            <th>Page</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {contentPages.map((page) => (
            <tr key={page.route}>
              <td>{page.label}</td>
              <td>
                <Button
                  font="dashboard"
                  variant="secondary"
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
