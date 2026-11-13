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

  // other-screens.md "Error": the error page's words and look, but without the layout (this replaces
  // it), so no header or footer and no site stylesheet: inline styles, the fonts' own fallbacks.
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          background: '#ffffff',
          color: '#1a1a1a',
          fontFamily: 'Lato, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <main
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 18,
            width: 'calc(100% - 48px)',
            maxWidth: 1160,
            margin: '0 auto',
          }}
        >
          <span
            style={{
              fontSize: 11.5,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#666666',
            }}
          >
            Error
          </span>
          <h1
            style={{
              margin: 0,
              fontFamily: '"EB Garamond", Georgia, serif',
              fontSize: 'clamp(36px, 6vw, 52px)',
              fontWeight: 400,
              lineHeight: 1.1,
            }}
          >
            Something went wrong.
          </h1>
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, color: '#555555' }}>
            Please try again in a moment.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 10,
              minHeight: 50,
              padding: '0 32px',
              border: 'none',
              borderRadius: 0,
              background: '#1a1a1a',
              color: '#ffffff',
              fontFamily: 'inherit',
              fontSize: 13,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
