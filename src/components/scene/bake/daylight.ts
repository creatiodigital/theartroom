import { Vector3 } from 'three'
import type { Color, Material, Mesh, MeshStandardMaterial, Object3D } from 'three'

/**
 * ⚠️ AR-161 — window daylight, the same for the admin's bake and a stored one: the window glass
 * shows the sky at the brightness the bake lit the room with. A stored bake's light came through
 * windows emitting the space's daylight gain × their display value, so visitors' glass must show
 * exactly that too (left at the display value it renders that many times dimmer than the light it
 * let in).
 *
 * The sun enters only through window glass (a portal, as in Blender), and a sky panel behind a
 * window (`windowLight\d+`) casts no shadow — the sky can't shade the sun.
 */

export const isWorldVisible = (object: Object3D) => {
  for (let o: Object3D | null = object; o; o = o.parent) if (!o.visible) return false
  return true
}

/** A window letting daylight in: where it enters (`mesh`) and the radiance it emits. */
export interface WindowDaylight {
  mesh: Mesh
  radiance: Color
}

/**
 * Gives every window's sky its physical brightness (× `gain`, the space's daylight gain; a light
 * well × `lightWell` more, the space's `lightWellDaylight`). Returns the windows the light enters
 * through (the bake's area emitters) and the undo. A sky material is brightened once, however many
 * openings show it. A throw midway puts back what it changed before rethrowing.
 */
export const brightenWindows = (
  scene: Object3D,
  gain: number,
  lightWell = 1,
): { windows: WindowDaylight[]; undo: () => void } => {
  const windows: WindowDaylight[] = []
  const restore: (() => void)[] = []
  const brightened = new Set<Material>()
  // Last change first: should two openings share one sky, each step puts back what it found.
  const undo = () =>
    restore
      .splice(0)
      .reverse()
      .forEach((step) => step())
  try {
    scene.traverse((o) => {
      const m = o as Mesh
      const material = m.material as MeshStandardMaterial | undefined
      if (!m.isMesh || !/^window(Glass|Light)\d+$/.test(m.name) || !material?.visible) return
      const at = m.getWorldPosition(new Vector3())
      const within3m = (pattern: RegExp, shownOnly: boolean) => {
        let found: Mesh | null = null
        scene.traverse((p) => {
          if (found || !(p as Mesh).isMesh || !pattern.test(p.name)) return
          if (shownOnly && !isWorldVisible(p)) return
          if (p.getWorldPosition(new Vector3()).distanceTo(at) < 3) found = p as Mesh
        })
        return found as Mesh | null
      }
      // The surface that shows the sky (its brightness) — `m` is where the light enters.
      let sky: Mesh = m
      let share = 1
      if (!m.visible) {
        // An open window (glass hidden) shows the sky panel behind it: the OPENING emits what
        // that panel shows, so daylight enters only through it — the panel itself, 2 m out and
        // wider than the hole, leaked through the wall beside the window onto the works hung there.
        if (!m.name.startsWith('windowGlass')) return
        const panel = within3m(/^windowLight\d+$/, true)
        if (!panel) return
        sky = panel
      } else if (m.name.startsWith('windowLight')) {
        // A daylight plane right behind a window is that window's sky: its glass (or, open,
        // its opening) already emits it. Planes behind an opening with no glass (a light
        // well) emit themselves.
        if (within3m(/^windowGlass\d+$/, false)) return
        // A light well opens onto a shaded court, not the open sky: it shows the space's share.
        share = lightWell
      }
      // The glass shows the sky; give it the sky's physical brightness — a window is far
      // brighter than any lamp — and emit exactly what it shows into the room.
      const skyMaterial = sky.material as MeshStandardMaterial
      if (!brightened.has(skyMaterial)) {
        brightened.add(skyMaterial)
        const previous = skyMaterial.emissiveIntensity
        skyMaterial.emissiveIntensity = previous * gain * share
        restore.push(() => {
          skyMaterial.emissiveIntensity = previous
        })
      }
      const radiance = skyMaterial.emissive.clone().multiplyScalar(skyMaterial.emissiveIntensity)
      if (radiance.r + radiance.g + radiance.b > 0) windows.push({ mesh: m, radiance })
    })
  } catch (error) {
    undo()
    throw error
  }
  return { windows, undo }
}
