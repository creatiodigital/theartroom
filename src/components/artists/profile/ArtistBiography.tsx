import { RichText } from '@/components/ui/RichText'

import styles from './ArtistProfile.module.scss'

/**
 * The artist's biography (rich text), rendered by the page on the server and
 * handed to the client profile as a ready node — rendered inside the client
 * component, RichText would ship the HTML sanitizer (~90 kB gzipped) to every
 * visitor of the page.
 */
export const ArtistBiography = ({ biography }: { biography: string }) => (
  <RichText content={biography} variant="compact" className={styles.biography} />
)
