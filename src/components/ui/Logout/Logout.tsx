'use client'

import { signOut } from 'next-auth/react'

import { Button } from '@/components/ui/Button'

/**
 * Logout component - renders a link-style button that logs the user out
 * and redirects to the home page.
 */
const Logout = () => {
  return (
    <Button variant="secondary" label="Log out" onClick={() => signOut({ callbackUrl: '/' })} />
  )
}

export default Logout
