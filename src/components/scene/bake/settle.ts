/**
 * ⚠️ AR-161 — when the room is ready for its light: whatever was loading has loaded and mounted,
 * so every artwork the light is put on is there. Shared by the live bake (before it measures the
 * room) and a stored bake (before it goes on).
 *
 * Counted in visible time: `requestAnimationFrame` stops in a hidden tab, and the first frame
 * back can be minutes long — it counts as one short frame, so it can't settle the room while
 * images are still on their way.
 */

/** Longest frame counted, in seconds. */
export const MAX_FRAME = 0.1
/** Seconds of no loading: whatever just loaded has mounted. */
export const SETTLE = 0.25
/** Seconds of no loading with a measured work still missing: its image isn't coming (it failed). */
export const GIVE_UP = 2

/** The room's idle time after one frame: any load in flight starts it over. */
export const settleStep = (idle: number, delta: number, loading: boolean): number =>
  loading ? 0 : idle + Math.min(Math.max(delta, 0), MAX_FRAME)

/**
 * Ready: the room is there, nothing has loaded for `SETTLE`, and every artwork the bake measured
 * shows (`missing` 0) — or nothing has loaded for `GIVE_UP`: a work still missing then failed to
 * load. Never while anything is loading.
 */
export const roomSettled = ({
  room,
  idle,
  missing,
}: {
  room: boolean
  idle: number
  missing: number
}): boolean => room && idle >= SETTLE && (missing === 0 || idle >= GIVE_UP)
