import Link from 'next/link'
import Image from 'next/image'

import { isSafeImageSrc } from '@/lib/imageSafety'

import { ExhibitionActions } from '@/components/exhibitions/ExhibitionActions'
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
}) => {
  const href = `/exhibitions/${exhibition.user.handler}/${exhibition.url}`
  // Same rule as the exhibition page's Enter button: only once its 3D room is out.
  const visitUrl = exhibition.spacePublished ? `${href}/visit` : null
  return (
    <li className={styles.listItem}>
      {/* Links side by side, never one inside another: the picture and the text each open the
          exhibition page (the picture's is a mouse shortcut, skipped by keyboard and screen
          readers), and the row under the text offers the page or the 3D room. */}
      <div className={styles.exhibition}>
        <Link href={href} className={styles.imageWrapper} tabIndex={-1} aria-hidden>
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
        </Link>
        <div className={styles.info}>
          <Link href={href} className={styles.infoLink}>
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
          </Link>
          <ExhibitionActions href={href} visitUrl={visitUrl} className={styles.actions} />
        </div>
      </div>
    </li>
  )
}

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
