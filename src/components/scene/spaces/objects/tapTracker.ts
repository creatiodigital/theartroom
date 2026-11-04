import { useState } from 'react'

/**
 * Taps on a phone or tablet (AR-172), for the objects that answer a click and
 * a double-click: a tap goes to the work, as a click does, and a double tap
 * does what a double-click does (the artwork's details, a sound's play/stop).
 *
 * A mouse keeps the browser's own double-click. A finger can't rely on it:
 * Safari spends a double tap on zooming the page, so double taps are counted
 * here instead, and the browser's dblclick is ignored after a touch, or a
 * device that sends both would act twice (and a sound would start and stop).
 */

/** A fingertip lands less precisely than a mouse: a tap may drift this far and still be one. */
const TOUCH_TAP_SLOP = 12

/** Two taps whose lifts are this close together (ms) make a double tap. */
const DOUBLE_TAP_WINDOW = 350

const createTapTracker = () => {
  let pointerType = 'mouse'
  let lastTapAt = 0
  return {
    /** Call on pointer down. */
    down(type: string) {
      pointerType = type
    },
    /** The last press came from a finger. */
    get touch() {
      return pointerType === 'touch'
    },
    /** How far the press may move and still be a tap. */
    slop(mouseSlop: number) {
      return pointerType === 'touch' ? TOUCH_TAP_SLOP : mouseSlop
    },
    /** Call on each tap by a finger: true when it completes a double tap. */
    secondTap() {
      const now = performance.now()
      if (now - lastTapAt < DOUBLE_TAP_WINDOW) {
        lastTapAt = 0
        return true
      }
      lastTapAt = now
      return false
    },
  }
}

/** One tracker per object, stable for its lifetime. */
export const useTapTracker = () => useState(createTapTracker)[0]
