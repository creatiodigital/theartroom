'use client'

import { Button } from '@/components/ui/Button'
import { signOutAndVerify } from '@/lib/auth/signOutAndVerify'

/**
 * Logout component — signs out, verifies the session is really gone, then
 * redirects to the home page. The why of the verify loop lives in
 * signOutAndVerify, which the admin menu's Log out shares.
 */
const Logout = () => {
  return <Button variant="secondary" label="Log out" onClick={() => void signOutAndVerify()} />
}

export default Logout
