'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'
import { ArtworkGrid } from '@/components/artwork/ArtworkGrid'
import { Button } from '@/components/ui/Button'
import { PageLayout } from '@/components/ui/PageLayout'
import { RichText } from '@/components/ui/RichText'
import { Share } from '@/components/ui/Share'
import { Text } from '@/components/ui/Typography'
import { isRichTextEmpty } from '@/lib/textUtils'
import { isSafeImageSrc } from '@/lib/imageSafety'
import type { PublicExhibition } from '@/lib/queries/getPublicExhibitionByUrl'

import styles from './ExhibitionProfile.module.scss'

interface ExhibitionProfilePageProps {
  artistSlug: string
  exhibitionSlug: string
  exhibition: PublicExhibition
}

export const ExhibitionProfilePage = ({
  artistSlug,
  exhibitionSlug,
  exhibition,
}: ExhibitionProfilePageProps) => {
  const pathname = usePathname()

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}${pathname}` : ''
  const visitUrl = `/exhibitions/${artistSlug}/${exhibitionSlug}/visit`
  const artistName = `${exhibition.user.name} ${exhibition.user.lastName}`

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

  return (
    <PageLayout>
      <div className={styles.content}>
        <div className={styles.heroSection}>
          <div className={styles.heroCta}>
            <Text as="h1" size="3xl" className={styles.title}>
              {exhibition.mainTitle}
            </Text>
            <Link href={`/artists/${exhibition.user.handler}`} className={styles.artist}>
              {artistName}
            </Link>
            <div
              onClick={() => {
                try {
                  sessionStorage.setItem(
                    'the-art-room:internal-nav',
                    JSON.stringify({
                      from: 'exhibition',
                      returnUrl: `/exhibitions/${artistSlug}/${exhibitionSlug}`,
                    }),
                  )
                } catch {}
              }}
            >
              <Button
                variant="primary"
                size="regularSquared"
                label="Enter Virtual Exhibition"
                href={visitUrl}
                iconLeft={<ArrowRight size={16} strokeWidth={ICON_STROKE_WIDTH} />}
                className={styles.button}
              />
            </div>
            <Share
              title={`${exhibition.mainTitle} — ${artistName}`}
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
                sizes="(max-width: 768px) 100vw, 66vw"
                className={styles.heroImage}
              />
            </div>
          )}
        </div>

        {dateRange && (
          <Text as="p" className={styles.dates}>
            {dateRange}
          </Text>
        )}

        {!isRichTextEmpty(exhibition.description) && (
          <RichText content={exhibition.description!} className={styles.description} />
        )}

        {exhibition.artworks.length > 0 && (
          <div className={styles.artworksSection}>
            <ArtworkGrid artworks={exhibition.artworks} artistName={artistName} />
          </div>
        )}
      </div>
    </PageLayout>
  )
}
