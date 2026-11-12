'use client'

import type { ReactNode } from 'react'

import { ArtworkGrid } from '@/components/artwork/ArtworkGrid'
import { ExhibitionRow } from '@/components/exhibitions/ExhibitionRow'
import { PageLayout } from '@/components/ui/PageLayout'
import { ProtectedImage } from '@/components/ui/ProtectedImage/ProtectedImage'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { TextSection } from '@/components/ui/TextSection'
import type {
  PublicArtistArtwork,
  PublicArtistExhibition,
} from '@/lib/queries/getPublicArtistByHandler'

import styles from './ArtistProfile.module.scss'

type Artist = {
  id: string
  name: string
  lastName: string
  handler: string
  biography: string | null
  profileImageUrl: string | null
}

// Both shapes come from the page's query, so the card's `sale` — whether the
// work is for sale and at what price — cannot be dropped on the way in.
type Exhibition = PublicArtistExhibition
type Artwork = PublicArtistArtwork

interface ArtistProfilePageProps {
  artist: Artist
  exhibitions: Exhibition[]
  artworks: Artwork[]
  /** `artist.biography`, rendered on the server (see ArtistBiography). */
  biography?: ReactNode
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * The artist page (docs/public-redesign/artist.md): hero, About the artist, Exhibitions (rows,
 * without the artist's name), Works. Data and links as before.
 */
export const ArtistProfilePage = ({
  artist,
  exhibitions,
  artworks,
  biography,
}: ArtistProfilePageProps) => {
  const artistFullName = `${artist.name} ${artist.lastName}`
  const exhibitionsCount = count(exhibitions.length, 'exhibition', 'exhibitions')
  const worksCount = count(artworks.length, 'work', 'works')
  // "1 exhibition · 26 works" (artist.md §1): from the data, nothing invented for none.
  const countsLine = [
    exhibitions.length > 0 ? exhibitionsCount : null,
    artworks.length > 0 ? worksCount : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <PageLayout>
      <div className={styles.content}>
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <span className={styles.eyebrow}>Artist</span>
            <h1 className={styles.name}>{artistFullName}</h1>
            {countsLine && <p className={styles.counts}>{countsLine}</p>}
          </div>
          <div className={styles.photo}>
            {artist.profileImageUrl ? (
              <ProtectedImage
                src={artist.profileImageUrl}
                alt={artistFullName}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 66vw"
                className={styles.photoImage}
              />
            ) : (
              <span className={styles.initials} aria-hidden>
                {artist.name.charAt(0)}
                {artist.lastName.charAt(0)}
              </span>
            )}
          </div>
        </section>

        <TextSection label="About the artist" className={styles.about}>
          {artist.biography ? biography : <p className={styles.empty}>No biography yet.</p>}
        </TextSection>

        <section className={styles.group} aria-label="Exhibitions">
          <SectionHeading
            title="Exhibitions"
            count={exhibitions.length > 0 ? exhibitionsCount : undefined}
          />
          {exhibitions.length === 0 ? (
            <p className={styles.empty}>No exhibitions yet.</p>
          ) : (
            <ul className={styles.rows}>
              {exhibitions.map((ex) => {
                const href = `/exhibitions/${artist.handler}/${ex.url}`
                return (
                  <ExhibitionRow
                    key={ex.id}
                    showArtist={false}
                    exhibition={{
                      id: ex.id,
                      href,
                      visitUrl: ex.spacePublished ? `${href}/visit` : null,
                      title: ex.mainTitle,
                      artistName: artistFullName,
                      description: ex.shortDescription,
                      imageUrl: ex.featuredImageUrl,
                    }}
                  />
                )
              })}
            </ul>
          )}
        </section>

        {artworks.length > 0 && (
          <section className={styles.group} aria-label="Works">
            <SectionHeading title="Works" count={worksCount} />
            {/* `artistHandler` marks the cards as a set the visitor is walking, so
                the artwork page can offer previous/next through this artist's
                works. `artistName` is the display name for the cards — different
                job, different value. */}
            <ArtworkGrid
              artworks={artworks}
              artistName={artistFullName}
              artistHandler={artist.handler}
              flushBottom
            />
          </section>
        )}
      </div>
    </PageLayout>
  )
}
