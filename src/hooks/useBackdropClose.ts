import { useRef, type MouseEvent } from 'react'

// Pointer travel above this is a drag, not a click. Covers the ordinary wobble between pressing and
// releasing without swallowing real clicks.
const DRAG_TOLERANCE_PX = 5

/**
 * A click on a dialog's backdrop (outside its panel) closes it: the Modal and the Inquire panel.
 * Spread the handlers on the backdrop element.
 *
 * Closes only if BOTH the press and the release happened on the backdrop itself (not a child) AND
 * the pointer barely moved. Without the distance check a DRAG that begins and ends on the backdrop
 * counts as a click — which silently dismissed the dialog whenever someone tried to drag something
 * underneath it, such as panning the 3D camera behind the exhibition's exit prompt. Without the
 * press check, selecting text inside the panel and releasing outside it would close it.
 */
export function useBackdropClose(onClose: () => void) {
  const pressedOnBackdrop = useRef(false)
  const pressedAt = useRef<{ x: number; y: number } | null>(null)

  const onMouseDown = (e: MouseEvent<HTMLElement>) => {
    pressedOnBackdrop.current = e.target === e.currentTarget
    pressedAt.current = { x: e.clientX, y: e.clientY }
  }

  const onMouseUp = (e: MouseEvent<HTMLElement>) => {
    const from = pressedAt.current
    const travelled = from ? Math.hypot(e.clientX - from.x, e.clientY - from.y) : Infinity
    if (
      pressedOnBackdrop.current &&
      e.target === e.currentTarget &&
      travelled <= DRAG_TOLERANCE_PX
    ) {
      onClose()
    }
    pressedOnBackdrop.current = false
    pressedAt.current = null
  }

  return { onMouseDown, onMouseUp }
}
