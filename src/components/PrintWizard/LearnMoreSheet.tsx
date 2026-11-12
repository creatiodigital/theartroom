import { ArrowLink } from '@/components/ui/ArrowLink'

import styles from './PrintWizard.module.scss'

/**
 * The Learn more window's content (order-flow.md "Learn more window"): "About your print", the
 * edition as the heading, the work and artist, then Terms of sale and Shipping with each
 * wizard's own points, and the full terms of sale (new tab). The heading names the dialog.
 */
export const LearnMoreSheet = ({
  editionType,
  title,
  artistName,
  terms,
  shipping,
}: {
  editionType: 'open' | 'limited'
  title: string
  artistName: string
  terms: string[]
  shipping: string[]
}) => (
  <div className={styles.introModal}>
    <span className={styles.introEyebrow}>About your print</span>
    <h2 id="print-intro-title" className={styles.introTitle}>
      {editionType === 'limited' ? 'Limited edition' : 'Open edition'}
    </h2>
    <p className={styles.introWork}>
      <em>{title}</em>, {artistName}
    </p>
    <div className={styles.detailSections}>
      <h3 className={styles.detailSubhead}>Terms of sale</h3>
      <ul className={styles.detailList}>
        {terms.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <h3 className={styles.detailSubhead}>Shipping</h3>
      <ul className={styles.detailList}>
        {shipping.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </div>
    <ArrowLink href="/terms-of-sale" newTab>
      Read the full terms of sale
    </ArrowLink>
  </div>
)
