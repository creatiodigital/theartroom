import { PageLayout } from '@/components/ui/PageLayout'

import type { ArtworkMediaItem } from '@/lib/artwork/artworkMediaTypes'
import type { PresentationView } from '@/lib/printPresentation/record'

import type { PublicArtistArtwork } from '@/lib/queries/getPublicArtistByHandler'

import { ArtworkBelowTheWork } from './ArtworkBelowTheWork'
import { ArtworkTechnique } from './ArtworkRichText'

import {
  ArtworkDetailBody,
  type Artwork,
  type Artist,
  type ArtworkCommerce,
  type ArtworkNeighbours,
} from './ArtworkDetailBody'
import styles from './ArtworkDetail.module.scss'

interface ArtworkDetailPageProps {
  artwork: Artwork
  artist: Artist
  commerce?: ArtworkCommerce | null
  /** Admin-edited purchase notes for this edition type. Absent = no copy. */
  /** Supplementary imagery. Empty for most works, and that is the normal case. */
  media?: ArtworkMediaItem[]
  /** Previous/next in the exhibition the visitor came from, when they did. */
  neighbours?: ArtworkNeighbours | null
  /** The work as a photo of the real print, when one is current and the switch is on. */
  presentation?: PresentationView | null
  /** Other works from the artist's page, for "More by the artist". */
  more?: PublicArtistArtwork[]
}

export const ArtworkDetailPage = ({
  artwork,
  artist,
  commerce,
  media = [],
  neighbours,
  presentation,
  more = [],
}: ArtworkDetailPageProps) => {
  return (
    <PageLayout>
      {/* The two columns, then what follows them (artwork.md "Below the work"). */}
      <div className={styles.standaloneContent}>
        <ArtworkDetailBody
          artwork={artwork}
          artist={artist}
          commerce={commerce}
          neighbours={neighbours}
          presentation={presentation}
          technique={artwork.technique ? <ArtworkTechnique technique={artwork.technique} /> : null}
        />
        <ArtworkBelowTheWork
          description={artwork.description}
          media={media}
          more={more}
          artist={artist}
        />
      </div>
    </PageLayout>
  )
}
