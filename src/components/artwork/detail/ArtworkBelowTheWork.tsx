import { ArtworkGrid } from '@/components/artwork/ArtworkGrid'
import { ArrowLink } from '@/components/ui/ArrowLink'
import type { ArtworkMediaItem } from '@/lib/artwork/artworkMediaTypes'
import type { PublicArtistArtwork } from '@/lib/queries/getPublicArtistByHandler'

import { ArtworkMediaGallery } from './ArtworkMediaGallery'
import { ArtworkStorySection } from './ArtworkStorySection'

import styles from './ArtworkBelowTheWork.module.scss'

/**
 * What follows the two columns (docs/public-redesign/artwork.md "Below the work"), on the artwork
 * page and in the 3D room's overlay alike: About the work, Details (the supplementary media), More by
 * the artist. Each is omitted when it has nothing to show.
 */
export const ArtworkBelowTheWork = ({
  description,
  media = [],
  more = [],
  artist,
}: {
  description?: string | null
  media?: ArtworkMediaItem[]
  /** Other works from the artist's page (getMoreByArtist). */
  more?: PublicArtistArtwork[]
  artist: { name: string; lastName: string; handler: string }
}) => {
  const artistName = `${artist.name} ${artist.lastName}`.trim()
  return (
    <>
      <ArtworkStorySection description={description} />
      <ArtworkMediaGallery media={media} />
      {more.length > 0 && artist.handler && (
        <section className={styles.more} aria-labelledby="more-by-artist-title">
          <div className={styles.moreHead}>
            <div className={styles.moreTitles}>
              <span className={styles.eyebrow}>More by the artist</span>
              <h2 id="more-by-artist-title" className={styles.name}>
                {artistName}
              </h2>
            </div>
            <ArrowLink href={`/artists/${artist.handler}`}>View artist</ArrowLink>
          </div>
          {/* The artist's set: the cards' links carry it, so the work they open can step through
              the same works with previous / next. */}
          <ArtworkGrid
            artworks={more}
            artistName={artistName}
            artistHandler={artist.handler}
            columns={4}
            flushBottom
          />
        </section>
      )}
    </>
  )
}
