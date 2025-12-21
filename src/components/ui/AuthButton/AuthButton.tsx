'use client'

import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'

import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { LoginModal } from '@/components/ui/LoginModal'

import styles from './AuthButton.module.scss'

export const AuthButton = () => {
  const { data: session, status } = useSession()
  const [showLoginModal, setShowLoginModal] = useState(false)

  if (status === 'loading') {
    return <div className={styles.authButton}>...</div>
  }

  if (session?.user) {
    return (
      <div className={styles.authButton}>
        <Link href="/dashboard" className={styles.userName}>
          {session.user.name}
        </Link>
        <Button variant="small" label="Log out" onClick={() => signOut({ callbackUrl: '/' })} />
      </div>
    )
  }

  return (
    <>
      <div className={styles.authButton}>
        <Button variant="small" label="Log in" onClick={() => setShowLoginModal(true)} />
      </div>
      {showLoginModal && (
        <Modal onClose={() => setShowLoginModal(false)}>
          <LoginModal onClose={() => setShowLoginModal(false)} />
        </Modal>
      )}
    </>
  )
}
