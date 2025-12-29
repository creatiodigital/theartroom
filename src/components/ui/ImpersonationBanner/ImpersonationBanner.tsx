'use client'

import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import { useEffectiveUser } from '@/hooks/useEffectiveUser'

import styles from './ImpersonationBanner.module.scss'

export const ImpersonationBanner = () => {
  const router = useRouter()
  const { isImpersonating, realUser, effectiveUser, stopImpersonation } = useEffectiveUser()

  if (!isImpersonating) {
    return null
  }

  const handleExit = async () => {
    await stopImpersonation()
    router.push('/admin/dashboard')
    router.refresh()
  }

  return (
    <div className={styles.banner}>
      <div className={styles.content}>
        <span className={styles.icon}>⚠️</span>
        <span className={styles.text}>
          <strong>{realUser?.name}</strong> impersonating: <strong>{effectiveUser?.name}</strong>
        </span>
      </div>
      <Button variant="small" label="Exit Impersonation" onClick={handleExit} />
    </div>
  )
}
