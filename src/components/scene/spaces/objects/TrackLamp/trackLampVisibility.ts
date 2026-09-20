/**
 * Whether a track lamp is part of the scene at all.
 *
 * Disabling a lamp used to leave the fixture hanging there unlit — a lamp that
 * was pure decoration. It now removes the whole fixture instead: arm, body,
 * bulb and spotlight.
 *
 * The rule lives here rather than inline because two places need the same
 * answer: the scene, which decides whether to render the lamp, and the
 * lighting sidebar, which greys out the rotation and offset sliders for a lamp
 * that is not in the room to aim.
 *
 * A lamp with no saved settings is visible — an exhibition saved before per-lamp
 * settings existed has no entry for any of its lamps, and every one of them
 * should still light the room.
 */
export type TrackLampSettings = {
  rotation?: number
  offset?: number
  enabled?: boolean
}

export const isTrackLampVisible = (settings: TrackLampSettings | undefined): boolean =>
  settings?.enabled ?? true
