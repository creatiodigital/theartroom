'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

import { ArrowLink } from '@/components/ui/ArrowLink'
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
