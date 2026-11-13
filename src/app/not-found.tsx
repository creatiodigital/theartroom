import { ArrowLink } from '@/components/ui/ArrowLink'
import { PageLayout } from '@/components/ui/PageLayout'
import { StatusPage } from '@/components/ui/StatusPage'

/** other-screens.md "404": Next answers a real 404 status (and noindex) for this page. */
export default function NotFound() {
  return (
    <PageLayout>
      <StatusPage
        label="Page not found"
        title="This page doesn’t exist."
        line="It may have moved, or the link may be incomplete."
        actions={
          <>
            <ArrowLink href="/">Back to the home page</ArrowLink>
            <ArrowLink href="/exhibitions">Exhibitions</ArrowLink>
          </>
        }
      />
    </PageLayout>
  )
}
