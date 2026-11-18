'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

import { ArrowLink } from '@/components/ui/ArrowLink'
import { track } from '@/lib/analytics/track'
import { Button } from '@/components/ui/Button'
import { PageLayout } from '@/components/ui/PageLayout'
import { StatusPage, statusPageStyles } from '@/components/ui/StatusPage'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
    // GA4's recommended `exception`: the digest (server errors) or the error's name, never its
    // message, which can carry anything. Sentry has the detail.
    track('exception', {
      description: error.digest ? `digest:${error.digest}` : error.name,
      fatal: false,
      page_path: window.location.pathname,
    })
  }, [error])

  // other-screens.md "Error": the normal header and footer, the same look as the 404.
  return (
    <PageLayout>
      <StatusPage
        label="Error"
        title="Something went wrong."
        line="Please try again in a moment."
        actions={
          <>
            <Button
              variant="primary"
              onClick={reset}
              label="Try again"
              className={statusPageStyles.primary}
            />
            <ArrowLink href="/">Back to the home page</ArrowLink>
          </>
        }
      />
    </PageLayout>
  )
}
