import type { MouseEvent } from 'react'

/**
 * For links that stay on screen after they navigate (the admin menu, the
 * wordmark). A mouse click leaves the link focused without a ring, but the
 * next key press anywhere on the page (an arrow key to scroll) makes the
 * browser treat it as keyboard focus and draw the ring on the menu item.
 * Drop focus after a pointer click; a keyboard Enter (detail 0) keeps it, so
 * keyboard users still see where they are.
 */
export function blurOnPointerClick(event: MouseEvent<HTMLElement>): void {
  if (event.detail > 0) event.currentTarget.blur()
}
