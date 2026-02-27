'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

/**
 * Global error boundary that wraps the entire HTML document.
 * This catches errors that happen outside of the root layout,
 * providing the absolute last line of defense.
 */
export default function RootError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#111',
          color: '#fff',
          fontFamily: 'Inter, system-ui, sans-serif',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem', fontWeight: 500 }}>
          Something went wrong
        </h2>
        <p style={{ color: '#999', fontSize: '0.875rem', maxWidth: '420px', lineHeight: 1.6 }}>
          We encountered an unexpected error. This has been reported and we&apos;re looking into it.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: '1.5rem',
            padding: '0.625rem 1.5rem',
            backgroundColor: '#333',
            color: '#fff',
            border: '1px solid #555',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
