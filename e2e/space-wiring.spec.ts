import fs from 'node:fs'
import path from 'node:path'

import { test, expect } from '@playwright/test'

import { deriveSpaceRefs, getNodeIndices } from '../src/components/scene/spaces/objects/nodeIndices'

// Two pieces of per-space wiring that panels depend on, both of which fail
// silently when they are wrong. Neither is caught by the model spec: the GLB can
// be perfect and the space component still not know what to do with it.

const ROOT = path.join(__dirname, '..')

test('a space that renders panels bakes all three panel families', () => {
  // The match is ^<prefix>\d+$, so 'panel' alone takes panel0 and leaves
  // panelFront0/panelBack0 behind — the box moves to the room offset and its two
  // hangable faces stay where Blender put them. In Vienna that is ~21m apart.
  const source = fs.readFileSync(
    path.join(ROOT, 'src/components/scene/spaces/ViennaSpace/ViennaSpace.tsx'),
    'utf8',
  )
  const block = source.slice(
    source.indexOf('ROOM_PARENTED_PREFIXES = ['),
    source.indexOf(']', source.indexOf('ROOM_PARENTED_PREFIXES = [')),
  )
  expect(block, 'ViennaSpace has no ROOM_PARENTED_PREFIXES — did it move?').toBeTruthy()

  for (const prefix of ['panel', 'panelFront', 'panelBack']) {
    expect(block, `'${prefix}' is not baked — its nodes render at the room offset`).toContain(
      `'${prefix}'`,
    )
  }
})

test('panels are counted into the collision refs a space allocates', () => {
  // Under-allocating silently drops collision: the visitor walks through the
  // panel with nothing in the console. Over-allocating is harmless.
  const nodes = {
    wall0: {}, wall1: {},
    invisibleWall0: {},
    radiator0: {},
    panel0: {}, panel1: {}, panel10: {},
    // Must NOT be counted — they are hangable faces, not solid surfaces.
    panelFront0: {}, panelBack0: {}, panelFront1: {}, panelBack1: {},
    windowFrame0: {}, windowGlass0: {},
  }
  const refs = deriveSpaceRefs(nodes)

  expect(refs.walls, 'walls must cover wall + invisibleWall + radiator + panel').toBe(2 + 1 + 1 + 3)
  expect(refs.windows).toBe(1)
  expect(refs.glass).toBe(1)
})

test('a panel face is never mistaken for a panel', () => {
  // getNodeIndices anchors its match, so the families stay separate. If this
  // ever regressed, every panel would gain two phantom siblings.
  const nodes = { panel0: {}, panel1: {}, panelFront0: {}, panelBack0: {}, panel10: {} }
  expect(getNodeIndices(nodes, 'panel')).toEqual([0, 1, 10])
  expect(getNodeIndices(nodes, 'panelFront')).toEqual([0])
  expect(getNodeIndices(nodes, 'panelBack')).toEqual([0])
})
