/**
 * Take a peek's files (docs/take-a-peek/README.md "The media"). If they move to
 * assets.theartroom.gallery, keep the names.
 */
const DIR = '/videos/take-a-peek'

/** The full video, 1024 × 576, no audio: requested only when the window opens. */
export const PEEK_FULL = `${DIR}/print-arrives-full.mp4`
/** The circle's loop: the first second of the full video, silent. WebM first. */
export const PEEK_PREVIEW_WEBM = `${DIR}/print-arrives-preview.webm`
export const PEEK_PREVIEW_MP4 = `${DIR}/print-arrives-preview.mp4`
/** The first frame: the loop's poster, and the still with reduced motion. */
export const PEEK_POSTER = `${DIR}/print-arrives-poster.jpg`

/**
 * The full video's length in whole seconds (27.1 s: the normal-pace recut, 2026-11-26), for the
 * circle's "0:27" before anything is loaded. The player reads the real one from the file once it
 * has it.
 */
export const PEEK_DURATION_S = 27

/** "0:27", "1:05". */
export const clock = (seconds: number) => {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}
