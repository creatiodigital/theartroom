'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical } from 'lucide-react'

import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'
import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'

const contentPages = [
  { label: 'Landing Page', route: '/admin/content/landing' },
  { label: 'About Us', route: '/admin/content/about' },
  { label: 'Terms and Conditions', route: '/admin/content/terms' },
  { label: 'Online Terms of Sale', route: '/admin/content/sale-terms' },
  { label: 'Privacy Policy', route: '/admin/content/privacy' },
  { label: 'Accessibility Policy', route: '/admin/content/accessibility' },
]

export const ContentManagement = () => {
  const router = useRouter()
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close kebab menu on outside click
  useEffect(() => {
    if (!openMenuId) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openMenuId])

  return (
    <div className={dashboardStyles.section}>
      <div className={dashboardStyles.sectionHeader}>
        <h2 className={dashboardStyles.sectionTitle}>Content Management</h2>
      </div>

      <table className={dashboardStyles.table}>
        <thead>
          <tr>
            <th>Page</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {contentPages.map((page) => (
            <tr key={page.route}>
              <td>{page.label}</td>
              <td>
                <div
                  className={dashboardStyles.kebabWrapper}
                  ref={openMenuId === page.route ? menuRef : undefined}
                >
                  <button
                    className={dashboardStyles.kebabButton}
                    onClick={() => setOpenMenuId(openMenuId === page.route ? null : page.route)}
                    aria-label="Actions"
                  >
                    <MoreVertical size={16} strokeWidth={ICON_STROKE_WIDTH} />
                  </button>
                  {openMenuId === page.route && (
                    <div className={dashboardStyles.kebabMenu}>
                      <button
                        className={dashboardStyles.kebabMenuItem}
                        onClick={() => {
                          setOpenMenuId(null)
                          router.push(page.route)
                        }}
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
