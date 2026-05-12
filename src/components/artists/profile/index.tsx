import { ProtectedImage } from '@/components/ui/ProtectedImage/ProtectedImage'

import { ArtworkGrid } from '@/components/artwork/ArtworkGrid'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageLayout } from '@/components/ui/PageLayout'
import { Text } from '@/components/ui/Typography'
import { RichText } from '@/components/ui/RichText'
import { NiceTitle } from '@/components/landing/NiceTitle/NiceTitle'
import { ExhibitionGrid } from '@/components/exhibitions/ExhibitionGrid'

import styles from './ArtistProfile.module.scss'

type Artist = {
  id: string
  name: string
  lastName: string
  handler: string
  biography: string | null
  profileImageUrl: string | null
}

type Exhibition = {
  id: string
  mainTitle: string
  url: string
  handler: string | null
  featuredImageUrl: string | null
  shortDescription: string | null
}

type Artwork = {
  id: string
  slug: string
  name: string
  title?: string | null
  author?: string | null
  year?: string | null
  technique?: string | null
  dimensions?: string | null
  imageUrl?: string | null
  originalWidth?: number | null
  originalHeight?: number | null
}

interface ArtistProfilePageProps {
  artist: Artist
  exhibitions: Exhibition[]
  artworks: Artwork[]
}

export const ArtistProfilePage = ({ artist, exhibitions, artworks }: ArtistProfilePageProps) => {
  const artistFullName = `${artist.name} ${artist.lastName}`

  return (
    <PageLayout>
      <div className={styles.header}>
        <div>
          <Text as="h1" size="huge" className={styles.artistName}>
            {artist.name} {artist.lastName}
          </Text>
        </div>
        {artist.profileImageUrl ? (
          <div className={styles.avatarWrapper}>
            <ProtectedImage
              src={artist.profileImageUrl}
              alt={artistFullName}
              fill
              priority
              sizes="(max-width: 768px) 50vw, 25vw"
              className={styles.avatar}
            />
          </div>
        ) : (
          <div className={styles.avatarPlaceholder}>
            {artist.name.charAt(0)}
            {artist.lastName.charAt(0)}
          </div>
        )}
      </div>

      <div className={styles.section}>
        {artist.biography ? (
          <RichText content={artist.biography} variant="compact" className={styles.biography} />
        ) : (
          <EmptyState message="No biography yet." />
        )}
      </div>

      {artworks.length > 0 && <NiceTitle title="Featured Works" align="left" />}

      {artworks.length > 0 && (
        <div className={styles.section}>
          <ArtworkGrid artworks={artworks} artistName={artistFullName} />
        </div>
      )}

      <NiceTitle title="Artist's Exhibitions" align="left" />
      <div className={styles.section}>
        {exhibitions.length === 0 ? (
          <EmptyState message="No exhibitions yet." />
        ) : (
          <ExhibitionGrid
            exhibitions={exhibitions.map((ex) => ({
              id: ex.id,
              mainTitle: ex.mainTitle,
              featuredImageUrl: ex.featuredImageUrl,
              shortDescription: ex.shortDescription,
              artistLabel: artistFullName,
              href: `/exhibitions/${artist.handler}/${ex.url}`,
            }))}
          />
        )}
      </div>
    </PageLayout>
  )
}
