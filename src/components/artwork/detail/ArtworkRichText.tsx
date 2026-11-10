import { RichText } from '@/components/ui/RichText'

import styles from './ArtworkDetail.module.scss'

/*
 * The artwork body's technique (rich text), rendered by whoever renders the body
 * and handed to it as a ready node. ArtworkDetailBody is a client component; if it
 * rendered RichText itself, the HTML sanitizer (sanitize-html + its parser,
 * ~90 kB gzipped) would ship to every artwork-page visitor. Rendered here, the
 * artwork page sanitizes on the server — the browser gets finished markup. The
 * 3D room's modal, whose data only exists in the browser, renders it there.
 */

export const ArtworkTechnique = ({ technique }: { technique: string }) => (
  <RichText content={technique} variant="compact" className={styles.technique} />
)
