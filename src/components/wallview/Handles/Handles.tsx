import type { ResizeHandler } from '@/types/wallView'

import styles from './Handles.module.scss'

export type THandles = {
  artworkId: string | ''
  handleResize: ResizeHandler<HTMLDivElement>
}

const Handles = ({ artworkId, handleResize }: THandles) => (
  <>
    {/* Edge resize zones – span full side, z-index 15 */}
    <div
      className={`${styles.edgeZone} ${styles.edgeTop}`}
      onMouseDown={(event) => handleResize(event, artworkId, 'top')}
    />
    <div
      className={`${styles.edgeZone} ${styles.edgeBottom}`}
      onMouseDown={(event) => handleResize(event, artworkId, 'bottom')}
    />
    <div
      className={`${styles.edgeZone} ${styles.edgeLeft}`}
      onMouseDown={(event) => handleResize(event, artworkId, 'left')}
    />
    <div
      className={`${styles.edgeZone} ${styles.edgeRight}`}
      onMouseDown={(event) => handleResize(event, artworkId, 'right')}
    />

    {/* Corner resize zones – z-index 16, override edges in overlap */}
    <div
      className={`${styles.edgeZone} ${styles.cornerTopLeft}`}
      onMouseDown={(event) => handleResize(event, artworkId, 'top-left')}
    />
    <div
      className={`${styles.edgeZone} ${styles.cornerTopRight}`}
      onMouseDown={(event) => handleResize(event, artworkId, 'top-right')}
    />
    <div
      className={`${styles.edgeZone} ${styles.cornerBottomLeft}`}
      onMouseDown={(event) => handleResize(event, artworkId, 'bottom-left')}
    />
    <div
      className={`${styles.edgeZone} ${styles.cornerBottomRight}`}
      onMouseDown={(event) => handleResize(event, artworkId, 'bottom-right')}
    />
  </>
)

export default Handles
