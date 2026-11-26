'use client'

import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'

import { ArtworkGrid } from '@/components/artwork/ArtworkGrid'
import { ArrowLink } from '@/components/ui/ArrowLink'
import { Band } from '@/components/ui/Band'
import { PageLayout } from '@/components/ui/PageLayout'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { Share } from '@/components/ui/Share'
import { hasPrintOnSale, TakeAPeek } from '@/components/ui/TakeAPeek'
import { TextSection } from '@/components/ui/TextSection'
import { usePurchasesPaused } from '@/hooks/usePurchasesPaused'
import { isRichTextEmpty } from '@/lib/textUtils'
import { isSafeImageSrc } from '@/lib/imageSafety'
import { SITE_URL } from '@/lib/siteUrl'
import type { PublicExhibition } from '@/lib/queries/getPublicExhibitionByUrl'

import { EnterExhibitionButton } from './EnterExhibitionButton'
import styles from './ExhibitionProfile.module.scss'

interface ExhibitionProfilePageProps {
  artistSlug: string
  exhibitionSlug: string
  exhibition: PublicExhibition
  /** `exhibition.description`, rendered on the server (see ExhibitionDescription). */
  description?: ReactNode
  /** The artist's biography, rendered on the server (see ArtistBiography). */
  artistBiography?: ReactNode
}

/**
 * The exhibition page (docs/public-redesign/exhibition.md): hero, About the exhibition, the series,
 * "Walk through the exhibition", About the artist. Data, links, cart and the 3D room entry as
 * before; the share links and the dates stay (questions.md Q-P11).
 */
export const ExhibitionProfilePage = ({
  artistSlug,
  exhibitionSlug,
  exhibition,
  description,
  artistBiography,
}: ExhibitionProfilePageProps) => {
  const shareUrl = `${SITE_URL}/exhibitions/${artistSlug}/${exhibitionSlug}`
  const visitUrl = `/exhibitions/${artistSlug}/${exhibitionSlug}/visit`
  const artistName = `${exhibition.user.name} ${exhibition.user.lastName}`
  const artistHref = `/artists/${exhibition.user.handler}`

  const formatDate = (date: Date | null) => {
    if (!date) return null
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const startDate = formatDate(exhibition.startDate)
  const endDate = formatDate(exhibition.endDate)
  const dateRange =
    startDate && endDate ? `${startDate} – ${endDate}` : startDate || endDate || null

  // No counts (owner, 2026-11-12: "26 works · 3 series" and each series' "N works" removed).

  // Take a peek (docs/take-a-peek, P3): once, above the first group with a print to order; none
  // when nothing can be ordered (no print, or purchases paused, as the grid's buttons).
  const purchasesPaused = usePurchasesPaused()
  const peekGroupIndex = purchasesPaused
    ? -1
    : exhibition.groups.findIndex((group) => hasPrintOnSale(group.artworks))

  const enter = (className?: string) =>
    exhibition.spacePublished ? (
      <EnterExhibitionButton
        artistSlug={artistSlug}
        exhibitionSlug={exhibitionSlug}
        visitUrl={visitUrl}
        className={className}
      />
    ) : null

  return (
    <PageLayout>
      <div className={styles.content}>
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <Link href={artistHref} className={styles.artist}>
              {artistName}
            </Link>
            <h1 className={styles.title}>{exhibition.mainTitle}</h1>
            {dateRange && <p className={styles.dates}>{dateRange}</p>}
            {enter(styles.enter)}
            <Share
              type="exhibition"
              exhibition={exhibition.mainTitle}
              artist={artistName}
              walkThrough={exhibition.spacePublished}
              url={shareUrl}
              className={styles.share}
            />
          </div>

          {exhibition.featuredImageUrl && isSafeImageSrc(exhibition.featuredImageUrl) && (
            <div className={styles.heroImageWrapper}>
              <Image
                src={exhibition.featuredImageUrl}
                alt={exhibition.mainTitle}
                fill
                priority
                // Skip the Vercel /_next/image optimizer: the source is an
                // already-optimized .webp on an immutable R2/CDN. Re-encoding it
                // on a cold transform is what made images break on first load
                // and only show after a refresh (AR-125).
                unoptimized
                sizes="(max-width: 1024px) 100vw, 66vw"
                className={styles.heroImage}
              />
            </div>
          )}
        </section>

        {!isRichTextEmpty(exhibition.description) && (
          <TextSection label="About the exhibition" variant="columns" className={styles.about}>
            {description}
          </TextSection>
        )}

        {exhibition.artworks.length > 0 && (
          <div className={styles.artworks}>
            {/* One grid per section, no-section works first with no heading.
                The slug rides along on every card link, so the artwork page
                can offer arrows through THIS exhibition's sequence. */}
            {exhibition.groups.map((group, index) => (
              <section
                key={group.id ?? 'unsectioned'}
                className={styles.group}
                aria-label={group.title ?? undefined}
              >
                {index === peekGroupIndex && (
                  <TakeAPeek
                    size="strip"
                    placement="exhibition"
                    line={`Works in this exhibition are also fine-art prints, approved by ${artistName}.`}
                    className={styles.peek}
                  />
                )}
                {group.title && <SectionHeading title={group.title} />}
                <ArtworkGrid
                  artworks={group.artworks}
                  artistName={artistName}
                  exhibitionSlug={exhibitionSlug}
                  showArtist
                  showEdition
                  flushBottom
                />
              </section>
            ))}
          </div>
        )}

        {exhibition.spacePublished && (
          <Band
            heading="Walk through the exhibition"
            line="See the exhibition in an interactive virtual space."
            action={enter()}
          />
        )}

        {/* As About the exhibition (owner, 2026-11-13): the label in the left third; across the
            right two thirds the name, the whole bio in two columns at the page's reading size, and
            View artist (no photo). One column on phones. */}
        <section className={styles.artistSection} aria-labelledby="about-the-artist">
          <h2 id="about-the-artist" className={styles.artistLabel}>
            About the artist
          </h2>
          <div className={styles.artistBody}>
            <h3 className={styles.artistName}>
              <Link href={artistHref}>{artistName}</Link>
            </h3>
            {artistBiography && <div className={styles.artistBio}>{artistBiography}</div>}
            <ArrowLink href={artistHref} className={styles.artistView}>
              View artist
            </ArrowLink>
          </div>
        </section>
      </div>
    </PageLayout>
  )
}
