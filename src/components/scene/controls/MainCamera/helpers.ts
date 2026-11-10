import type { RefObject } from 'react'
import { Vector3, Camera, Quaternion } from 'three'

import { CLICK_MAX_MOVE_PX, TAP_MAX_MS } from './navigation'

/**
 * The mouse on the room (see `navigation`): a click walks (or stands in front of the artwork
 * under it), a press and drag looks around, turning and tilting at once, as a head does (AR-177, owner,
 * 2026-11-05: tried one way at a time, then "bring back the mixed axis movement"; a finger keeps its
 * lock, where a slide is never straight). The tilt stops at `PITCH_LIMIT` (MainCamera).
 *
 * The drag grabs the room, as in Google Street View: what was under the mouse stays under it.
 * Drag right and the room comes right (the head turns left); drag up and it goes up (the head looks
 * down). The pixels dragged are kept here; MainCamera turns them into the angle that keeps the room
 * under the mouse on this screen, with this lens (AR-177, owner, 2026-11-05: the room turned "way more"
 * than the mouse moved).
 */
export type MouseState = {
  /** A left press that began on the room and has not lifted. */
  pressed: boolean
  /** The press began on the canvas itself (not a button or panel over it): it may be a click. */
  onRoom: boolean
  startX: number
  startY: number
  startedAt: number
  lastX: number
  lastY: number
  /** The press has moved past a click's slop: it is looking around. */
  looking: boolean
  /**
   * The room grabbed and dragged since the last frame (px), right and down positive: by the mouse,
   * a finger (MainCamera adds a finger's here) or the trackpad's sideways swipe.
   */
  grabX: number
  grabY: number
  /** The trackpad's walk. */
  wheelZ: number
  /** Where the mouse rests over the room (client px), for the floor ring; null when off it. */
  hover: { x: number; y: number } | null
  hoverMoved: boolean
}

export const createMouseState = (): MouseState => ({
  pressed: false,
  onRoom: false,
  startX: 0,
  startY: 0,
  startedAt: 0,
  lastX: 0,
  lastY: 0,
  looking: false,
  grabX: 0,
  grabY: 0,
  wheelZ: 0,
  hover: null,
  hoverMoved: false,
})

/** A press: `onRoom` when it landed on the canvas, `now` in ms. */
export const pressMouse = (
  state: MouseState,
  x: number,
  y: number,
  onRoom: boolean,
  now: number,
) => {
  state.pressed = true
  state.onRoom = onRoom
  state.startX = state.lastX = x
  state.startY = state.lastY = y
  state.startedAt = now
  state.looking = false
  state.grabX = 0
  state.grabY = 0
  state.hover = null
}

/** The mouse moved: a drag's turn and tilt, or (no button down) where the floor ring goes. */
export const moveMouse = (state: MouseState, x: number, y: number, overRoom: boolean) => {
  if (!state.pressed) {
    state.hover = overRoom ? { x, y } : null
    state.hoverMoved = true
    return
  }
  if (!state.looking) {
    if (Math.hypot(x - state.startX, y - state.startY) < CLICK_MAX_MOVE_PX) return
    // lastX/lastY still hold the start, so the travel past the slop counts too.
    state.looking = true
  }
  state.grabX += x - state.lastX
  state.grabY += y - state.lastY
  state.lastX = x
  state.lastY = y
}

/** The press lifted, at `now` (ms): where a click landed (client px), or null for a drag. */
export const releaseMouse = (state: MouseState, now: number) => {
  const click =
    state.pressed && state.onRoom && !state.looking && now - state.startedAt <= TAP_MAX_MS
      ? { x: state.startX, y: state.startY }
      : null
  state.pressed = false
  state.looking = false
  state.grabX = 0
  state.grabY = 0
  return click
}

/** A drag is under way that has begun to look around (past a click's slop). */
export const dragging = (state: MouseState) => state.pressed && state.looking

export const handleKeyPress = (
  keysPressed: RefObject<Record<string, boolean>>,
  key: string,
  isPressed: boolean,
) => {
  if (!keysPressed.current) return
  keysPressed.current[key.toLowerCase()] = isPressed
}

/**
 * In Wall View the same keys move over the wall instead, never turning (AR-178, owner, 2026-11-07: "the up
 * and down arrows will move the camera up and down WITHOUT rotating the camera"): which way, right
 * and up positive.
 */
export const wallMoveKeys = (keysPressed: RefObject<Record<string, boolean>>) => {
  const down = (key: string) => (keysPressed.current?.[key] ? 1 : 0)
  return {
    x: Math.sign(down('d') + down('arrowright')) - Math.sign(down('a') + down('arrowleft')),
    y: Math.sign(down('w') + down('arrowup')) - Math.sign(down('s') + down('arrowdown')),
  }
}

export const calculateMovementVector = (
  keysPressed: RefObject<Record<string, boolean>>,
  moveSpeed: number,
  camera: Camera & { quaternion: Quaternion },
): Vector3 => {
  const moveVector = new Vector3()

  if (keysPressed.current?.['w'] || keysPressed.current?.['arrowup']) moveVector.z -= 1
  if (keysPressed.current?.['s'] || keysPressed.current?.['arrowdown']) moveVector.z += 1
  if (keysPressed.current?.['a'] || keysPressed.current?.['arrowleft']) moveVector.x -= 1
  if (keysPressed.current?.['d'] || keysPressed.current?.['arrowright']) moveVector.x += 1

  if (moveVector.lengthSq() > 0) {
    moveVector.normalize().multiplyScalar(moveSpeed)
    // Along the floor whatever the head's tilt: the camera's heading alone.
    moveVector.applyQuaternion(camera.quaternion)
    const length = moveVector.length()
    moveVector.y = 0
    if (moveVector.lengthSq() > 0) moveVector.setLength(length)
  }

  return moveVector
}
