'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'

import { Button } from '@/components/ui/Button'

export const DashboardExhibitionsPage = () => {
  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '2rem',
        }}
      >
        <div>
          <Link
            href="/dashboard"
            style={{ color: '#666', textDecoration: 'none', fontSize: '0.875rem' }}
          >
            ← Back to Dashboard
          </Link>
          <h1 style={{ margin: '0.5rem 0 0', fontSize: '1.75rem' }}>My Exhibitions</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
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

      <p>Manage your current and past exhibitions</p>

      {/* Exhibition list will go here */}
      <div style={{ marginTop: '2rem' }}>
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
