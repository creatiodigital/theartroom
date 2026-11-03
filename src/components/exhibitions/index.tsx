import Link from 'next/link'
import Image from 'next/image'
import c from 'classnames'
import { ArrowRight } from 'lucide-react'
import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'

import { isSafeImageSrc } from '@/lib/imageSafety'

import { EnterVirtualLink } from '@/components/exhibitions/EnterVirtualLink'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageLayout } from '@/components/ui/PageLayout'
import { Text } from '@/components/ui/Typography'

import styles from './exhibitions.module.scss'

type Exhibition = {
  id: string
  mainTitle: string
  url: string
  status: string
  featuredImageUrl: string | null
  shortDescription: string | null
  /** Its 3D space is published: the card offers a way straight in. */
  spacePublished: boolean
  user: {
    name: string
    lastName: string
    handler: string
  }
}

interface ExhibitionsPageProps {
  exhibitions: Exhibition[]
}

const ExhibitionCard = ({
  exhibition,
  priority,
}: {
  exhibition: Exhibition
  priority?: boolean
}) => (
  <li className={styles.listItem}>
    {/* The whole card opens the exhibition (its "Visit exhibition" link is stretched over it);
        "Enter 3D room" is a link of its own on top, never inside that one. */}
    <div className={styles.exhibitionLink}>
      <div className={styles.imageWrapper}>
        {exhibition.featuredImageUrl && isSafeImageSrc(exhibition.featuredImageUrl) ? (
          <Image
            src={exhibition.featuredImageUrl}
            alt={exhibition.mainTitle}
            fill
            // Skip the Vercel optimizer: source is already-optimized .webp on an
            // immutable R2/CDN; cold re-encodes broke images on first load (AR-125).
            unoptimized
            sizes="(max-width: 768px) 100vw, 55vw"
            className={styles.image}
            priority={priority}
          />
        ) : (
          <div className={styles.imagePlaceholder} />
        )}
      </div>
      <div className={styles.info}>
        <Text as="span" font="serif" size="xl" className={styles.artistName}>
          {exhibition.user.name} {exhibition.user.lastName}
        </Text>
        <Text as="span" font="serif" size="3xl" className={styles.exhibitionTitle}>
          {exhibition.mainTitle}
        </Text>
        {exhibition.shortDescription && (
          <Text as="p" size="sm" className={styles.description}>
            {exhibition.shortDescription}
          </Text>
        )}
        <Link
          href={`/exhibitions/${exhibition.user.handler}/${exhibition.url}`}
          className={c(styles.visitLink, styles.stretched)}
          aria-label={`Visit exhibition: ${exhibition.mainTitle}`}
        >
          <ArrowRight size={16} strokeWidth={ICON_STROKE_WIDTH} />
          <span>Visit exhibition</span>
        </Link>
        {exhibition.spacePublished && (
          <EnterVirtualLink
            href={`/exhibitions/${exhibition.user.handler}/${exhibition.url}/visit`}
            className={styles.enterLink}
          />
        )}
      </div>
    </div>
  </li>
)

export const ExhibitionsPage = ({ exhibitions }: ExhibitionsPageProps) => {
  const currentExhibitions = exhibitions.filter((e) => e.status === 'current')
  const pastExhibitions = exhibitions.filter((e) => e.status === 'past')

  return (
    <PageLayout>
      <PageHeader
        pageTitle="Exhibitions"
        pageSubtitle="Explore our curated exhibitions, both current and past."
      />
      <section className={styles.section}>
        {currentExhibitions.length === 0 ? (
          <EmptyState message="No current exhibitions." />
        ) : (
          <ul className={styles.list}>
            {currentExhibitions.map((exhibition, idx) => (
              <ExhibitionCard key={exhibition.id} exhibition={exhibition} priority={idx === 0} />
            ))}
          </ul>
        )}
      </section>

      {pastExhibitions.length > 0 && (
        <section className={styles.section}>
          <Text as="h2" className={styles.sectionTitle}>
            Past
          </Text>
          <ul className={styles.list}>
            {pastExhibitions.map((exhibition) => (
              <ExhibitionCard key={exhibition.id} exhibition={exhibition} />
            ))}
          </ul>
        </section>
      )}
    </PageLayout>
  )
}
