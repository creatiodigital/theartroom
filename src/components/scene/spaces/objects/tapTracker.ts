import { useState } from 'react'
import type { Ray } from 'three'

import { TAP_MAX_MOVE_PX } from '@/components/scene/controls/MainCamera/navigation'
import { roomBlocks } from '@/components/scene/controls/MainCamera/roomRays'

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
const TOUCH_TAP_SLOP = TAP_MAX_MOVE_PX

/**
 * Two taps (or clicks) this close together (ms) make a double tap, which opens a work's details.
 * A single tap on a work waits this long before going to it, in case a second follows; taps on the
 * floor and walls never wait.
 */
export const DOUBLE_TAP_MS = 300

/**
 * Fingers on the screen, counted for the whole page. A pinch puts two down, and
 * the finger that barely moved would otherwise end as a "tap" on the work
 * beneath it and send the camera gliding off mid-zoom. Capture-phase listeners,
 * so the count is current before any object handles the lift.
 */
let fingersDown = 0
let severalFingers = false
let counting = false
const countFingers = () => {
  if (counting || typeof window === 'undefined') return
  counting = true
  const options = { capture: true, passive: true }
  window.addEventListener(
    'pointerdown',
    (event) => {
      if (event.pointerType !== 'touch') return
      if (fingersDown === 0) severalFingers = false
      fingersDown += 1
      if (fingersDown > 1) severalFingers = true
    },
    options,
  )
  const lift = (event: PointerEvent) => {
    if (event.pointerType === 'touch') fingersDown = Math.max(0, fingersDown - 1)
  }
  window.addEventListener('pointerup', lift, options)
  window.addEventListener('pointercancel', lift, options)
}

const createTapTracker = () => {
  countFingers()
  let pointerType = 'mouse'
  let lastTapAt = 0
  let behindWall = false
  return {
    /**
     * Call on pointer down. The scene's pointer events reach every object the ray passes, walls
     * or no walls, so a press whose object lies behind a wall (a work in the next room, seen
     * through nothing) is the wall's: the visitor walks up to the wall instead.
     */
    down(event: { pointerType: string; ray?: Ray; distance?: number }) {
      pointerType = event.pointerType
      behindWall =
        !!event.ray && event.distance !== undefined && roomBlocks(event.ray, event.distance)
    },
    /** The last press came from a finger. */
    get touch() {
      return pointerType === 'touch'
    },
    /**
     * Not this object's tap, however short: more than one finger has been down since this touch
     * began (a pinch), or the object is behind a wall.
     */
    get ignored() {
      return behindWall || (pointerType === 'touch' && severalFingers)
    },
    /** How far the press may move and still be a tap. */
    slop(mouseSlop: number) {
      return pointerType === 'touch' ? TOUCH_TAP_SLOP : mouseSlop
    },
    /** Call on each tap by a finger: true when it completes a double tap. */
    secondTap() {
      const now = performance.now()
      if (now - lastTapAt < DOUBLE_TAP_MS) {
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
