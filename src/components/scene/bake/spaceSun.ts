import { Vector3 } from 'three'

/**
 * AR-169 — ONE sun per space (Eduardo 2026-10-31, on Vienna, whose windows face two ways: "yes, one
 * real sun"). It shines straight in (the look's azimuth, elevation) through the windows that face
 * the way most of the space's glass faces; a window facing elsewhere gets no direct sun (it keeps
 * its sky light). Each window had its own sun straight in until then — impossible for a real sun.
 * Shared by the bake (`bakeJob`) and the beams (`SunBeams`), so the beams always land on the
 * baked patches. A space whose windows all face one way (Paris, Madrid) is unchanged.
 */
export interface SunWindow {
  /** Horizontal unit normal into the room. */
  inward: Vector3
  /** Glass area, m². */
  area: number
}

/** A window lets the sun in when its horizontal travel is at least this much into the room. */
const SUN_ENTERS = 0.2

const UP = new Vector3(0, 1, 0)

/** Where the space's sun travels (into the rooms, downward), or null without windows. */
export const spaceSunDirection = (
  windows: SunWindow[],
  elevationDeg: number,
  azimuthDeg: number,
): Vector3 | null => {
  const facings: SunWindow[] = []
  for (const w of windows) {
    const same = facings.find((f) => f.inward.dot(w.inward) > 0.99)
    if (same) same.area += w.area
    else facings.push({ inward: w.inward.clone(), area: w.area })
  }
  if (!facings.length) return null
  const main = facings.reduce((a, b) => (b.area > a.area ? b : a))
  const elevation = (elevationDeg * Math.PI) / 180
  const azimuth = (azimuthDeg * Math.PI) / 180
  return main.inward
    .clone()
    .applyAxisAngle(UP, azimuth)
    .multiplyScalar(Math.cos(elevation))
    .add(new Vector3(0, -Math.sin(elevation), 0))
}

/** Whether the space's sun comes in through a window facing `inward`. */
export const sunEnters = (sun: Vector3, inward: Vector3): boolean =>
  inward.dot(new Vector3(sun.x, 0, sun.z).normalize()) > SUN_ENTERS
