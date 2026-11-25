import { ArtworkBelowTheWork } from '@/components/artwork/detail/ArtworkBelowTheWork'
import type { ArtworkNeighbours } from '@/components/artwork/detail/ArtworkDetailBody'
import { ArtworkTechnique } from '@/components/artwork/detail/ArtworkRichText'
import { PageLayout } from '@/components/ui/PageLayout'
import type { ArtworkMediaItem } from '@/lib/artwork/artworkMediaTypes'
import type { PublicArtistArtwork } from '@/lib/queries/getPublicArtistByHandler'
import { isRichTextEmpty } from '@/lib/textUtils'

import detail from '@/components/artwork/detail/ArtworkDetail.module.scss'
import { ObjectDetailBody, type ObjectPageArtwork } from './ObjectDetailBody'

export type ObjectPageData = ObjectPageArtwork & {
  technique: string | null
  description: string | null
}

/**
 * An Object's artwork page: the image artwork page (docs/objects O5b): the grey box (3D model,
 * cover) and the info column, then what follows every artwork, unchanged: About the work, the
 * photos and videos in the editor's order as the image page's carousel (the cover is not among
 * them), More by the artist. Anyone can explore it fully without the 3D room.
 */
export type ObjectPageProps = {
  artwork: ObjectPageData
  artist: { name: string; lastName: string; handler: string }
  media: ArtworkMediaItem[]
  more: PublicArtistArtwork[]
  neighbours?: ArtworkNeighbours | null
  /** `room`: inside the 3D room's overlay. */
  surface?: 'page' | 'room'
}

export function ObjectDetailPage(props: ObjectPageProps) {
  return (
    <PageLayout>
      <div className={detail.standaloneContent}>
        <ObjectPageContent {...props} />
      </div>
    </PageLayout>
  )
}

/** The page's content, without the site's frame: the artwork page, and the 3D room's window. */
export function ObjectPageContent({
  artwork,
  artist,
  media,
  more,
  neighbours,
  surface = 'page',
}: ObjectPageProps) {
  return (
    <>
      <ObjectDetailBody
        artwork={artwork}
        artist={artist}
        neighbours={neighbours}
        surface={surface}
        technique={
          isRichTextEmpty(artwork.technique) ? null : (
            <ArtworkTechnique technique={artwork.technique!} />
          )
        }
      />
      <ArtworkBelowTheWork
        description={artwork.description}
        media={media}
        more={more}
        artist={artist}
      />
    </>
  )
}
