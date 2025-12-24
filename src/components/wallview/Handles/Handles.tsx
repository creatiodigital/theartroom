import { Handle } from '@/components/wallview/Handle'
import type { ResizeHandler } from '@/types/wallView'

export type THandles = {
  artworkId: string | ''
  handleResize: ResizeHandler<HTMLDivElement>
}

const Handles = ({ artworkId, handleResize }: THandles) => (
  <>
    {/* Corner handles (diagonal resize) */}
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
    
    {/* Edge handles (single-axis resize) */}
    <Handle
      direction="top"
      onMouseDown={(event) => handleResize(event, artworkId, 'top')}
    />
    <Handle
      direction="bottom"
      onMouseDown={(event) => handleResize(event, artworkId, 'bottom')}
    />
    <Handle
      direction="left"
      onMouseDown={(event) => handleResize(event, artworkId, 'left')}
    />
    <Handle
      direction="right"
      onMouseDown={(event) => handleResize(event, artworkId, 'right')}
    />
  </>
)

export default Handles
