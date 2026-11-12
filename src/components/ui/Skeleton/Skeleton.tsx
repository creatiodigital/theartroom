import type { CSSProperties } from 'react'
import c from 'classnames'

import { PageIntro } from '@/components/ui/PageIntro'
import { PageLayout } from '@/components/ui/PageLayout'

import styles from './Skeleton.module.scss'

/**
 * Loading placeholders (docs/public-redesign/other-screens.md "Loading states"): calm #f2f2f2 blocks,
 * square, no spinner and no shimmer (at most a very slow pulse, off under reduced motion), sitting
 * where the real content will be at its size, so nothing jumps when it arrives. Known headings are
 * real text.
 */
export const Block = ({
  width,
  height,
  className,
}: {
  width?: CSSProperties['width']
  height?: CSSProperties['height']
  className?: string
}) => <span className={c(styles.block, className)} style={{ width, height }} aria-hidden />

/** The list pages (Exhibitions, Artists): the real title, then two rows like ExhibitionRow / ArtistRow. */
export const ListPageLoading = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <PageLayout>
    <div className={styles.page} aria-busy="true">
      <PageIntro title={title} subtitle={subtitle} />
      {[0, 1].map((row) => (
        <div key={row} className={styles.row}>
          <Block className={styles.rowImage} />
          <div className={styles.rowText}>
            <Block width={140} height={12} />
            <Block width="60%" height={30} />
            <Block width="100%" height={14} />
            <Block width="94%" height={14} />
            <Block width="70%" height={14} />
            <Block width={220} height={16} className={styles.rowLink} />
          </div>
        </div>
      ))}
    </div>
  </PageLayout>
)

/** A grid page (Prints): the real title, then square works with their two caption lines. */
export const GridPageLoading = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <PageLayout>
    <div className={styles.page} aria-busy="true">
      <PageIntro title={title} subtitle={subtitle} />
      <div className={styles.grid}>
        {[0, 1, 2, 3, 4, 5].map((card) => (
          <div key={card} className={styles.card}>
            <Block className={styles.cardImage} />
            <Block width="55%" height={18} />
            <Block width="30%" height={14} />
          </div>
        ))}
      </div>
    </div>
  </PageLayout>
)

/** The artwork page: the image block on the left, the 320 px column's blocks on the right. */
export const ArtworkLoading = () => (
  <PageLayout>
    <div className={styles.artwork} aria-busy="true">
      <Block className={styles.artworkImage} />
      <div className={styles.artworkInfo}>
        <Block width={120} height={12} />
        <Block width="80%" height={36} />
        <Block width={60} height={14} />
        <Block width={110} height={14} />
        <span className={styles.rule} />
        <Block width={110} height={30} />
        <Block width="75%" height={13} />
        <Block width="100%" height={48} />
        <Block width="100%" height={46} />
      </div>
    </div>
  </PageLayout>
)
