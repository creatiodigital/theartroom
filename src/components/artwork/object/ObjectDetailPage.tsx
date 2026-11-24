import { ArtworkBelowTheWork } from '@/components/artwork/detail/ArtworkBelowTheWork'
import type { ArtworkNeighbours } from '@/components/artwork/detail/ArtworkDetailBody'
import { ArtworkTechnique } from '@/components/artwork/detail/ArtworkRichText'
import { ArtworkStorySection } from '@/components/artwork/detail/ArtworkStorySection'
import { PageLayout } from '@/components/ui/PageLayout'
import { RichText } from '@/components/ui/RichText'
import { TextSection } from '@/components/ui/TextSection'
import type { ArtworkMediaItem } from '@/lib/artwork/artworkMediaTypes'
import {
  coverObjectPosition,
  isObjectMediaRole,
  OBJECT_MEDIA_ROLE_LABEL,
} from '@/lib/artwork/objectArtwork'
import type { PublicArtistArtwork } from '@/lib/queries/getPublicArtistByHandler'
import { isRichTextEmpty } from '@/lib/textUtils'

import detail from '@/components/artwork/detail/ArtworkDetail.module.scss'
import { ObjectDetailBody, type ObjectPageArtwork, type ObjectView } from './ObjectDetailBody'
import { ObjectDetails, type ObjectDetailsFields } from './ObjectDetails'
import { ObjectInMotion } from './ObjectInMotion'
import styles from './ObjectDetail.module.scss'

export type ObjectPageData = ObjectPageArtwork &
  ObjectDetailsFields & {
    technique: string | null
    description: string | null
    originalWidth: number | null
    originalHeight: number | null
    coverCropX: number | null
    coverCropY: number | null
  }

/**
 * An Object's artwork page (docs/objects O5): the approved artwork page's frame (artwork.md),
 * the stage of views and the info column, then About the work, Materials, Details, In motion,
 * Photographs and More by the artist. Anyone can explore it fully without the 3D room.
 *
 * The photos split by their label: labelled ones (Front, Back, Side, Detail, In a room, Process)
 * are the stage's views after the cover, in the editor's order; the unlabelled ones are the
 * Photographs; the videos are In motion.
 */
export function ObjectDetailPage({
  artwork,
  artist,
  media,
  more,
  neighbours,
}: {
  artwork: ObjectPageData
  artist: { name: string; lastName: string; handler: string }
  media: ArtworkMediaItem[]
  more: PublicArtistArtwork[]
  neighbours?: ArtworkNeighbours | null
}) {
  const title = artwork.title || artwork.name || 'Artwork'
  const images = media.filter((m) => m.kind === 'image' && m.url)
  const labelled = images.filter((m) => isObjectMediaRole(m.role) && m.role !== 'reel')
  const photographs = images.filter((m) => !isObjectMediaRole(m.role))
  const videos = media.filter((m) => m.kind === 'video' && m.url)

  const views: ObjectView[] = [
    ...(artwork.imageUrl
      ? [
          {
            id: 'cover',
            url: artwork.imageUrl,
            label: null,
            caption: null,
            thumbPosition: coverObjectPosition(
              { x: artwork.coverCropX, y: artwork.coverCropY },
              { width: artwork.originalWidth, height: artwork.originalHeight },
            ),
          },
        ]
      : []),
    ...labelled.map((m) => ({
      id: m.id,
      url: m.url,
      label: isObjectMediaRole(m.role) ? OBJECT_MEDIA_ROLE_LABEL[m.role] : null,
      caption: m.caption,
      thumbPosition: '50% 50%',
    })),
  ]

  return (
    <PageLayout>
      <div className={detail.standaloneContent}>
        <ObjectDetailBody
          artwork={artwork}
          artist={artist}
          views={views}
          neighbours={neighbours}
          technique={artwork.technique ? <ArtworkTechnique technique={artwork.technique} /> : null}
        />

        <ArtworkStorySection description={artwork.description} />
        {!isRichTextEmpty(artwork.technique) && (
          <TextSection label="Materials" className={styles.belowSection}>
            <RichText content={artwork.technique!} variant="page" />
          </TextSection>
        )}
        <ObjectDetails fields={artwork} />
        <ObjectInMotion videos={videos} title={title} />

        {photographs.length > 0 && (
          <section className={styles.mediaSection} aria-labelledby="object-photographs">
            <div className={styles.mediaHead}>
              <h2 id="object-photographs" className={styles.eyebrow}>
                Photographs
              </h2>
            </div>
            <div className={styles.photoGrid}>
              {photographs.map((photo, i) => (
                <figure key={photo.id} className={styles.photo}>
                  <img
                    src={photo.url}
                    alt={photo.caption || `${title}, photograph ${i + 1}`}
                    className={styles.photoImage}
                    loading="lazy"
                    decoding="async"
                  />
                  {photo.caption && (
                    <figcaption className={styles.figcaption}>{photo.caption}</figcaption>
                  )}
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* Only More by the artist: the story is above, and an Object's media are its own. */}
        <ArtworkBelowTheWork media={[]} more={more} artist={artist} />
      </div>
    </PageLayout>
  )
}
