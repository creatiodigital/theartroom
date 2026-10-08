import Link from 'next/link'

import { ProtectedImage } from '@/components/ui/ProtectedImage/ProtectedImage'

import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageLayout } from '@/components/ui/PageLayout'

import styles from './artists.module.scss'

type Artist = {
  id: string
  name: string
  lastName: string
  handler: string
  biography: string | null
  profileImageUrl: string | null
}

interface ArtistsPageProps {
  artists: Artist[]
}

export const ArtistsPage = ({ artists }: ArtistsPageProps) => {
  return (
    <PageLayout>
      {artists.length === 0 ? (
        <EmptyState message="No artists found." />
      ) : (
        <>
          <PageHeader
            pageTitle="Artists"
            pageSubtitle="Participants in current and past exhibitions."
          />
          <ul className={styles.list}>
            {artists.map((artist) => (
              <li key={artist.id}>
                <Link href={`/artists/${artist.handler}`} className={styles.artistRow}>
                  {artist.profileImageUrl && (
                    <ProtectedImage
                      src={artist.profileImageUrl}
                      alt={`${artist.name} ${artist.lastName}`}
                      width={200}
                      height={140}
                      sizes="200px"
                      wrapperClassName={styles.imageContainer}
                      className={styles.featuredImage}
                    />
                  )}
                  <span className={styles.artistName}>
                    {artist.name} {artist.lastName}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </PageLayout>
  )
}
