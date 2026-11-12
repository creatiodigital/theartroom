import Image from 'next/image'
import Link from 'next/link'

import { ExhibitionActions } from '@/components/exhibitions/ExhibitionActions'
import { isSafeImageSrc } from '@/lib/imageSafety'

import styles from './ExhibitionRow.module.scss'

export type ExhibitionRowData = {
  id: string
  /** The exhibition page. */
  href: string
  /** The 3D room, once its space is published; else none. */
  visitUrl: string | null
  title: string
  artistName: string
  description: string | null
  imageUrl: string | null
}

/**
 * One exhibition in a list (docs/public-redesign/components.md "ExhibitionRow", exhibitions.md): a
 * 340px 3:2 image, the artist in small caps (left out on the artist's own page), the title, the
 * description clamped to 3 lines (2 on phones), and the two links. The image and the title open
 * the exhibition page; the image's link is a mouse shortcut, skipped by keyboard and screen readers.
 */
export const ExhibitionRow = ({
  exhibition,
  showArtist = true,
  priority,
}: {
  exhibition: ExhibitionRowData
  showArtist?: boolean
  priority?: boolean
}) => {
  const { href, visitUrl, title, artistName, description, imageUrl } = exhibition
  return (
    <li className={styles.row}>
      <Link href={href} className={styles.imageLink} tabIndex={-1} aria-hidden>
        {imageUrl && isSafeImageSrc(imageUrl) ? (
          <Image
            src={imageUrl}
            alt=""
            fill
            // Skip the Vercel optimizer: source is already-optimized .webp on an
            // immutable R2/CDN; cold re-encodes broke images on first load (AR-125).
            unoptimized
            sizes="(max-width: 768px) 100vw, 340px"
            className={styles.image}
            priority={priority}
          />
        ) : (
          <span className={styles.placeholder} />
        )}
      </Link>
      <div className={styles.text}>
        {showArtist && <span className={styles.artist}>{artistName}</span>}
        <h3 className={styles.title}>
          <Link href={href}>{title}</Link>
        </h3>
        {description && <p className={styles.description}>{description}</p>}
        <ExhibitionActions href={href} visitUrl={visitUrl} className={styles.actions} />
      </div>
    </li>
  )
}
