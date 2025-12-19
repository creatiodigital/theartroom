'use client'

import Link from 'next/link'

export const DashboardProfilePage = () => {
  return (
    <div>
      <Link href="/dashboard">← Back to Dashboard</Link>
      
      <h1>Edit Profile</h1>
      <p>Manage your artist profile information</p>
      
      {/* Profile edit form will go here */}
    </div>
  )
}
