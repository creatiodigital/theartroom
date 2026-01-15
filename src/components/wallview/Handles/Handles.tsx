import { Handle } from '@/components/wallview/Handle'
import type { ResizeHandler } from '@/types/wallView'

import styles from './Handles.module.scss'

export type THandles = {
  artworkId: string | ''
  handleResize: ResizeHandler<HTMLDivElement>
}

const Handles = ({ artworkId, handleResize }: THandles) => (
  <>
    {/* Corner handles (diagonal resize) - visible */}
    <Handle
      direction="top-left"
      onMouseDown={(event) => handleResize(event, artworkId, 'top-left')}
    />
    <Handle
      direction="top-right"
      onMouseDown={(event) => handleResize(event, artworkId, 'top-right')}
    />
    <Handle
      direction="bottom-left"
      onMouseDown={(event) => handleResize(event, artworkId, 'bottom-left')}
    />
    <Handle
      direction="bottom-right"
      onMouseDown={(event) => handleResize(event, artworkId, 'bottom-right')}
    />

    {/* Edge resize zones (invisible, but full edge is draggable like Figma) */}
    <div
      className={styles.edgeZone}
      style={{ top: -4, left: 12, right: 12, height: 8, cursor: 'ns-resize' }}
      onMouseDown={(event) => handleResize(event, artworkId, 'top')}
    />
    <div
      className={styles.edgeZone}
      style={{ bottom: -4, left: 12, right: 12, height: 8, cursor: 'ns-resize' }}
      onMouseDown={(event) => handleResize(event, artworkId, 'bottom')}
    />
    <div
      className={styles.edgeZone}
      style={{ left: -4, top: 12, bottom: 12, width: 8, cursor: 'ew-resize' }}
      onMouseDown={(event) => handleResize(event, artworkId, 'left')}
    />
    <div
      className={styles.edgeZone}
      style={{ right: -4, top: 12, bottom: 12, width: 8, cursor: 'ew-resize' }}
      onMouseDown={(event) => handleResize(event, artworkId, 'right')}
    />
  </>
)

export default Handles
