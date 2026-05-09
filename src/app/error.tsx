'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

import { Button } from '@/components/ui/Button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--color-text-primary)',
        color: 'var(--color-white)',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem', fontWeight: 500 }}>
        Something went wrong
      </h2>
      <p
        style={{
          color: 'var(--color-text-secondary)',
          fontSize: '0.875rem',
          maxWidth: '420px',
          lineHeight: 1.6,
        }}
      >
        We encountered an unexpected error. This has been reported and we&apos;re looking into it.
      </p>
      <div style={{ marginTop: '1.5rem' }}>
        <Button variant="secondary" onClick={reset} label="Try again" />
      </div>
    </div>
  )
}
