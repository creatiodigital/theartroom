import { test, expect } from '@playwright/test'
import { Mesh, MeshStandardMaterial, PlaneGeometry, Scene } from 'three'

import { brightenWindows } from '@/components/scene/bake/daylight'
import { spaceLooks } from '@/lib/bake/spaceLooks'

// AR-165: Paris's opening at the end of the exit corridor has no glass, so its sky panel
// (`windowLight1`) is a light well that lights the room itself. At a window's full daylight it
// burned the corridor walls white (Eduardo 2026-10-23: "that light is too intense"). A light well
// shows the space's `lightWellDaylight` share of it; window glass and the sky behind it keep theirs.

const sky = (name: string, x: number, z: number) => {
  const mesh = new Mesh(
    new PlaneGeometry(1, 1),
    new MeshStandardMaterial({ emissive: 0xffffff, emissiveIntensity: 1.26 }),
  )
  mesh.name = name
  mesh.position.set(x, 1.5, z)
  return mesh
}

const room = () => {
  const scene = new Scene()
  const glass = sky('windowGlass0', 0, 0)
  // 2 m behind the glass: that window's sky, which the glass emits.
  const behindGlass = sky('windowLight0', 0, -2)
  // 13 m from any glass: a light well.
  const well = sky('windowLight1', 10, 8)
  scene.add(glass, behindGlass, well)
  scene.updateMatrixWorld(true)
  return { scene, glass, behindGlass, well }
}

const intensity = (mesh: Mesh) => (mesh.material as MeshStandardMaterial).emissiveIntensity

test('a light well shows and emits its share of the daylight; window glass keeps the full gain', () => {
  const { scene, glass, behindGlass, well } = room()
  const { windows } = brightenWindows(scene, 6, 0.25)

  expect(intensity(glass)).toBeCloseTo(1.26 * 6)
  expect(intensity(well)).toBeCloseTo(1.26 * 6 * 0.25)
  // The sky behind the glass is only seen through it: not an emitter, not brightened.
  expect(intensity(behindGlass)).toBeCloseTo(1.26)

  const byName = new Map(windows.map((w) => [w.mesh.name, w.radiance.r]))
  expect([...byName.keys()].sort()).toEqual(['windowGlass0', 'windowLight1'])
  expect(byName.get('windowGlass0')).toBeCloseTo(1.26 * 6)
  // What you see is what lights the room.
  expect(byName.get('windowLight1')).toBeCloseTo(1.26 * 6 * 0.25)
})

test('without a light-well share a light well emits the full daylight (Madrid, Vienna)', () => {
  const { scene, well } = room()
  brightenWindows(scene, 6)
  expect(intensity(well)).toBeCloseTo(1.26 * 6)
})

test('undo puts every brightness back', () => {
  const { scene, glass, behindGlass, well } = room()
  brightenWindows(scene, 6, 0.25).undo()
  for (const mesh of [glass, behindGlass, well]) expect(intensity(mesh)).toBeCloseTo(1.26)
})

test('only Paris dims its light well; Vienna and Madrid keep their approved looks', () => {
  const share = spaceLooks.paris!.look.lightWellDaylight
  expect(share).toBeGreaterThan(0)
  expect(share).toBeLessThan(1)
  expect(spaceLooks.vienna!.look.lightWellDaylight).toBeUndefined()
  expect(spaceLooks.madrid!.look.lightWellDaylight).toBeUndefined()
  // Everything else Paris shares with Vienna stays as approved.
  const { lightWellDaylight: _, ...rest } = spaceLooks.paris!.look
  expect(rest).toEqual(spaceLooks.vienna!.look)
})
