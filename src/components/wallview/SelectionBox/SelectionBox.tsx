'use client'

import styles from './SelectionBox.module.scss'

export type TSelectionBox = {
  selectionBox: {
    startX: number
    endX: number
    startY: number
    endY: number
  }
  scaleFactor: number
}

// Note: scaleFactor is kept in props for backwards compatibility but not used
// The parent CenterPanel applies CSS transform: scale(scaleFactor) to the wall wrapper,
// so the selection box coordinates (stored in wall space) are automatically scaled
const SelectionBox = ({ selectionBox }: TSelectionBox) => (
  <div
    className={styles.selectionBox}
    style={{
      left: `${Math.min(selectionBox.startX, selectionBox.endX)}px`,
      top: `${Math.min(selectionBox.startY, selectionBox.endY)}px`,
      width: `${Math.abs(selectionBox.endX - selectionBox.startX)}px`,
      height: `${Math.abs(selectionBox.endY - selectionBox.startY)}px`,
    }}
  ></div>
)

export default SelectionBox
