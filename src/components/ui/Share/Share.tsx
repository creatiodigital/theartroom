'use client'

import { Envelope } from '@phosphor-icons/react'
import c from 'classnames'

import { track } from '@/lib/analytics/track'

import styles from './Share.module.scss'

const WhatsAppIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 15 15"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
  >
    <path d="M15 7.30704C15 11.3423 11.7033 14.6136 7.63573 14.6136C6.34493 14.6136 5.13239 14.2834 4.07686 13.7053L0 15L1.32895 11.0787C0.658852 9.97815 0.272932 8.68588 0.272932 7.30655C0.273421 3.27127 3.56915 0 7.63671 0C11.7038 0.00097825 15 3.27176 15 7.30704ZM7.63524 1.1651C4.22164 1.1651 1.44488 3.92083 1.44488 7.30851C1.44488 8.65262 1.88313 9.89696 2.62416 10.9094L1.85134 13.1902L4.22947 12.4345C5.20772 13.0763 6.37819 13.45 7.63524 13.45C11.0488 13.45 13.8266 10.6947 13.8266 7.30704C13.8276 3.92083 11.0493 1.1651 7.63524 1.1651ZM11.3546 8.99012C11.3086 8.91626 11.1882 8.87126 11.0083 8.78126C10.8287 8.69126 9.94 8.25839 9.77517 8.19969C9.60886 8.13953 9.48854 8.10921 9.36821 8.28871C9.24936 8.46822 8.90306 8.87126 8.79692 8.99159C8.69175 9.11142 8.58659 9.12659 8.4061 9.03805C8.22562 8.94708 7.64356 8.75925 6.95389 8.14931C6.41732 7.67388 6.05488 7.0884 5.95021 6.90889C5.84407 6.72987 5.93945 6.63303 6.02896 6.54401C6.10966 6.4633 6.20944 6.33466 6.29993 6.2295C6.39042 6.12531 6.42026 6.05146 6.48042 5.93162C6.5396 5.81178 6.50977 5.7076 6.46526 5.61711C6.42026 5.52711 6.05977 4.64669 5.90863 4.28816C5.75847 3.93012 5.60831 3.9893 5.50266 3.9893C5.3975 3.9893 5.27717 3.97463 5.15685 3.97463C5.03652 3.97463 4.84087 4.01816 4.67604 4.19767C4.5112 4.37718 4.04458 4.81006 4.04458 5.69146C4.04458 6.57384 4.69071 7.42443 4.7812 7.54378C4.87218 7.66263 6.03042 9.5306 7.86513 10.2477C9.70082 10.9642 9.70082 10.725 10.0315 10.6947C10.3631 10.6644 11.0997 10.2618 11.2494 9.84413C11.4 9.42446 11.4 9.06496 11.3546 8.99012Z" />
  </svg>
)

type ShareProps = {
  /** The page's canonical address (SITE_URL + path): no `?from=`, no tracking parameters. */
  url: string
  className?: string
} & (
  | { type: 'artwork'; title: string; artist?: string | null }
  | {
      type: 'exhibition'
      exhibition: string
      artist: string
      /** Its 3D room is open: the message says it can be walked through. */
      walkThrough: boolean
    }
  | { type: 'artist'; artist: string }
)

/** What is being shared, as a sentence, and the email's subject (docs/take-a-peek T8). */
const describe = (props: ShareProps): { sentence: string; subject: string } => {
  switch (props.type) {
    case 'artwork': {
      const work = props.artist ? `${props.title} by ${props.artist}` : props.title
      return { sentence: `${work}, at The Art Room`, subject: `${work} · The Art Room` }
    }
    case 'exhibition':
      return {
        // "Walk through in 3D" only when there is a room to walk through.
        sentence: props.walkThrough
          ? `${props.exhibition}, an exhibition by ${props.artist} you can also walk through in 3D`
          : `${props.exhibition}, an exhibition by ${props.artist} at The Art Room`,
        subject: `${props.exhibition} · The Art Room`,
      }
    case 'artist':
      return {
        sentence: `${props.artist} at The Art Room`,
        subject: `${props.artist} · The Art Room`,
      }
  }
}

/**
 * Share (docs/take-a-peek/README.md T8; designs/Share.dc.html): one quiet row, always open, on
 * artwork, exhibition and artist pages and the room's artwork pop-up, once per page. WhatsApp
 * (wa.me: the app on phones, WhatsApp Web on computers) and Email (the visitor's mail app). Nothing
 * loads from WhatsApp until clicked.
 */
export const Share = (props: ShareProps) => {
  const { url, className, type } = props
  const { sentence, subject } = describe(props)
  const whatsApp = `https://wa.me/?text=${encodeURIComponent(`${sentence}: ${url}`)}`
  const email = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    `I thought you’d like this: ${sentence}.\n\n${url}`,
  )}`

  return (
    <div className={c(styles.share, className)}>
      <span className={styles.label}>Share</span>
      <a
        href={whatsApp}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.link}
        aria-label="Share on WhatsApp"
        onClick={() => track('share_click', { method: 'whatsapp', type })}
      >
        <WhatsAppIcon />
        WhatsApp
      </a>
      <a
        href={email}
        className={styles.link}
        aria-label="Share by email"
        onClick={() => track('share_click', { method: 'email', type })}
      >
        <Envelope size={17} weight="light" aria-hidden />
        Email
      </a>
    </div>
  )
}
