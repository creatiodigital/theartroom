'use client'

import Link from 'next/link'

export const DashboardExhibitionsPage = () => {
  return (
    <div>
      <Link href="/dashboard">← Back to Dashboard</Link>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
        <h1>My Exhibitions</h1>
        <button onClick={() => {/* TODO: Open new exhibition modal/wizard */}}>
          + New Exhibition
        </button>
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
