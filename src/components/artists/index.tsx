import { EmptyState } from '@/components/ui/EmptyState'
import { PageIntro } from '@/components/ui/PageIntro'
import { PageLayout } from '@/components/ui/PageLayout'

import { ARTISTS_SEARCH_FROM, ArtistsList } from './ArtistsList'
import styles from './artists.module.scss'

type Artist = {
  id: string
  name: string
  lastName: string
  handler: string
  profileImageUrl: string | null
}

interface ArtistsPageProps {
  artists: Artist[]
}

/**
 * /artists (docs/public-redesign/artists.md): one row per artist, the portrait and the name only
 * (owner, 2026-11-12: no exhibition titles, no bio; the bio is the long one, on the artist page).
 */
export const ArtistsPage = ({ artists }: ArtistsPageProps) => {
  const rows = artists.map((artist) => ({
    href: `/artists/${artist.handler}`,
    name: `${artist.name} ${artist.lastName}`.trim(),
    imageUrl: artist.profileImageUrl,
  }))

  return (
    <PageLayout>
      <div className={styles.page}>
        {artists.length === 0 ? (
          <EmptyState message="No artists found." />
        ) : (
          <>
            <PageIntro
              title="Artists"
              subtitle={
                <>
                  The artists we show, in current and past exhibitions.
                  {/* The count joins the line once the list has its tools (artists.md). */}
                  {artists.length >= ARTISTS_SEARCH_FROM && (
                    <span className={styles.count}> {artists.length} artists.</span>
                  )}
                </>
              }
            />
            <ArtistsList artists={rows} />
          </>
        )}
      </div>
    </PageLayout>
  )
}
