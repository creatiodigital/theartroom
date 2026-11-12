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
  // No counts anywhere on the page (owner, 2026-11-12: "1 exhibition · 8 works" removed).

  return (
    <PageLayout>
      <div className={styles.content}>
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <span className={styles.eyebrow}>Artist</span>
            <h1 className={styles.name}>{artistFullName}</h1>
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

        <TextSection label="About the artist" variant="columns" className={styles.about}>
          {artist.biography ? biography : <p className={styles.empty}>No biography yet.</p>}
        </TextSection>

        <section className={styles.group} aria-label="Exhibitions">
          <SectionHeading title="Exhibitions" />
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
            <SectionHeading title="Works" />
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
