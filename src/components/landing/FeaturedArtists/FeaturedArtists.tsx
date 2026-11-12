import Link from 'next/link'

import { HomeSectionHead } from '@/components/landing/HomeSectionHead/HomeSectionHead'
import { ProtectedImage } from '@/components/ui/ProtectedImage/ProtectedImage'

import styles from './FeaturedArtists.module.scss'

type FeaturedArtist = {
  id: string
  name: string
  lastName: string
  handler: string
  biography: string
  profileImageUrl: string | null
}

interface FeaturedArtistsProps {
  artists: FeaturedArtist[]
}

/**
 * The homepage's Featured artists (docs/public-redesign/home.md §6): today's featured artists as
 * portrait photos (4:5, cropped from the sides; owner, 2026-11-12), four in a row (two on phones),
 * the name in serif only, each a link to the artist's page; "All artists" on the heading row.
 */
export const FeaturedArtists = ({ artists }: FeaturedArtistsProps) => {
  if (artists.length === 0) return null

  return (
    <section className={styles.section}>
      {/* Owner, 2026-11-12: "Featured artists" (home.md §6 drew "Artists"); sentence case, as the
          page's other headings. */}
      {/* The hairline above, as Current exhibitions and Announcements (owner, 2026-11-12). */}
      <HomeSectionHead
        title="Featured artists"
        rule
        link={{ href: '/artists', label: 'All artists' }}
      />

      <ul className={styles.grid}>
        {artists.map((artist) => (
          <li key={artist.id}>
            <Link href={`/artists/${artist.handler}`} className={styles.artist}>
              <span className={styles.imageBox}>
                {artist.profileImageUrl && (
                  <ProtectedImage
                    src={artist.profileImageUrl}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 50vw, 420px"
                    className={styles.image}
                  />
                )}
              </span>
              <span className={styles.name}>
                {artist.name} {artist.lastName}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
