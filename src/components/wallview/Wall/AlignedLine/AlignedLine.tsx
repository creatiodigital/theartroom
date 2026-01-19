'use client'

import styles from './AlignedLine.module.scss'

type LineRect = {
  x: number
  y: number
  width: number
  height: number
}

type Direction =
  | 'horizontal'
  | 'vertical'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'center-horizontal'
  | 'center-vertical'

type AlignedLineProps = {
  start: LineRect
  end: LineRect
  direction: Direction
  color?: string
}

const AlignedLine: React.FC<AlignedLineProps> = ({ start, end, direction, color }) => {
  const isHorizontal =
    direction === 'horizontal' ||
    direction === 'top' ||
    direction === 'bottom' ||
    direction === 'center-horizontal'

  // For alignment lines, use consistent positions from the target artwork (end)
  // to avoid 1px offset when artworks are within tolerance but not exactly aligned
  const alignedY = direction === 'top' ? end.y
    : direction === 'bottom' ? end.y + end.height
    : direction === 'center-horizontal' ? end.y + end.height / 2
    : 0

  const alignedX = direction === 'left' ? end.x
    : direction === 'right' ? end.x + end.width
    : direction === 'center-vertical' ? end.x + end.width / 2
    : 0

  const lineStart = {
    x: isHorizontal
      ? Math.min(start.x, end.x)
      : alignedX,
    y: isHorizontal
      ? alignedY
      : Math.min(start.y, end.y),
  }

  const lineEnd = {
    x: isHorizontal
      ? Math.max(start.x + start.width, end.x + end.width)
      : alignedX,
    y: isHorizontal
      ? alignedY
      : Math.max(start.y + start.height, end.y + end.height),
  }

  const style: React.CSSProperties = {
    width: isHorizontal ? `${lineEnd.x - lineStart.x}px` : '1px',
    height: isHorizontal ? '1px' : `${lineEnd.y - lineStart.y}px`,
    top: `${lineStart.y}px`,
    left: `${lineStart.x}px`,
    ...(color && { backgroundColor: color }),
  }

  return <div className={styles.line} style={style} />
}

export default AlignedLine
