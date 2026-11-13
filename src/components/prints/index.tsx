import Link from 'next/link'

import { ArrowLink, ArrowLinkDivider, ArrowLinkRow } from '@/components/ui/ArrowLink'
import { Band } from '@/components/ui/Band'
import { PageIntro } from '@/components/ui/PageIntro'
import { PageLayout } from '@/components/ui/PageLayout'
import { RichText } from '@/components/ui/RichText'
import type { GallerySelectionCard } from '@/lib/queries/getGallerySelection'

import { PrintsBanner } from './PrintsBanner'
import { PrintsSelection } from './PrintsSelection'
import styles from './prints.module.scss'
import type { PrintsPageContent } from './types'

interface PrintsPageProps {
  /** The gallery's selection, already ordered and already filtered to what a
   *  buyer can complete. Empty is a legitimate state, not an error. */
  selection: GallerySelectionCard[]
  pageContent: PrintsPageContent | null
}

/**
 * /prints (docs/public-redesign/prints.md): a selection, not the catalogue, and the page says so
 * (the intro line, the count, the closing band). Data, admin selection and links as before.
 */
export const PrintsPage = ({ selection, pageContent }: PrintsPageProps) => {
  const hasDescription =
    !!pageContent?.content && pageContent.content.trim() !== '' && pageContent.content !== '<p></p>'

  return (
    <PageLayout>
      <div className={styles.page}>
        <PageIntro
          title="Prints"
          subtitle="A selection of prints from our artists. Many more works are available as prints on each exhibition and artist page."
        />

        <section className={styles.intro}>
          <PrintsBanner
            imageUrl={pageContent?.bannerImageUrl ?? null}
            alt={pageContent?.title || 'Fine-art prints'}
          />
          <div className={styles.description}>
            <span className={styles.eyebrow}>Fine-art prints</span>
            <h2 className={styles.descriptionTitle}>
              Every print, approved and signed by the artist.
            </h2>
            {/* The paragraphs are the page editor's (Admin › Content › Prints), as before. */}
            {hasDescription && (
              <RichText content={pageContent!.content} className={styles.descriptionText} />
            )}
          </div>
        </section>

        {selection.length === 0 ? (
          /* A legitimate state — nothing selected yet, or everything selected has
             gone quiet. The page keeps its banner and copy and says so, rather
             than showing a blank grid that reads as broken. The toolbar goes with
             it: filters over nothing, and a cart that can hold nothing bought
             from this page. */
          <p className={styles.selectionEmpty}>
            New prints are being selected. In the meantime, every artist&rsquo;s available work is
            on <Link href="/artists">their own page</Link>.
          </p>
        ) : (
          <PrintsSelection selection={selection} />
        )}

        <Band
          heading="Many more works are available as prints"
          line="This page shows a selection. Almost every work in our exhibitions can be ordered as a print, from the exhibition or the artist’s page."
          action={
            <ArrowLinkRow>
              <ArrowLink href="/exhibitions">Browse exhibitions</ArrowLink>
              <ArrowLinkDivider />
              <ArrowLink href="/artists">Browse artists</ArrowLink>
            </ArrowLinkRow>
          }
        />
      </div>
    </PageLayout>
  )
}
