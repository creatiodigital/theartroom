import { ArtworkBelowTheWork } from '@/components/artwork/detail/ArtworkBelowTheWork'
import type { ArtworkNeighbours } from '@/components/artwork/detail/ArtworkDetailBody'
import { ArtworkTechnique } from '@/components/artwork/detail/ArtworkRichText'
import { PageLayout } from '@/components/ui/PageLayout'
import type { ArtworkMediaItem } from '@/lib/artwork/artworkMediaTypes'
import { isObjectMediaRole, OBJECT_MEDIA_ROLE_LABEL } from '@/lib/artwork/objectArtwork'
import type { PublicArtistArtwork } from '@/lib/queries/getPublicArtistByHandler'
import { isRichTextEmpty } from '@/lib/textUtils'

import detail from '@/components/artwork/detail/ArtworkDetail.module.scss'
import { ObjectDetailBody, type ObjectPageArtwork, type ObjectPhoto } from './ObjectDetailBody'

export type ObjectPageData = ObjectPageArtwork & {
  technique: string | null
  description: string | null
}

/**
 * An Object's artwork page: the image artwork page (docs/objects O5b): the grey box (3D model,
 * cover, then the photos, with their tiles in the info column; owner, 2026-11-25) and the info
 * column, then what follows every artwork, unchanged: About the work, the videos and reels in the
 * editor's order as the image page's carousel, More by the artist. Anyone can explore it fully
 * without the 3D room.
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
  const photos: ObjectPhoto[] = media
    .filter((m) => m.kind === 'image' && m.url)
    .map((m) => ({
      id: m.id,
      url: m.url,
      width: m.width,
      height: m.height,
      label: isObjectMediaRole(m.role) ? OBJECT_MEDIA_ROLE_LABEL[m.role] : null,
      caption: m.caption,
    }))
  const videos = media.filter((m) => m.kind === 'video')
  return (
    <>
      <ObjectDetailBody
        artwork={artwork}
        artist={artist}
        photos={photos}
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
        media={videos}
        more={more}
        artist={artist}
      />
    </>
  )
}
