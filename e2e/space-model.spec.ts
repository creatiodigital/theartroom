import fs from 'node:fs'
import path from 'node:path'

import { test, expect } from '@playwright/test'

import { getNodeIndices } from '../src/components/scene/spaces/objects/nodeIndices'
import { loadGlb, type LoadedGlb } from './glb-helpers'

// Holds a space model to the contract in docs/display-panels.md.
//
// Every one of these failures is SILENT in the app. Call sites that read a node
// are null-guarded, so a bad export throws nothing — the prop just never appears.
// A Vienna re-export once dropped `initialPoint0`, `invisibleWall0`, `exit0` and
// `continue0` at the same time and nothing in the console said so.
//
// GLBs are gitignored (they live in R2), so this skips when the file is absent
// rather than failing for anyone who has not pulled them down.

const ROOT = path.join(__dirname, '..')
const MODEL = 'public/assets/spaces/vienna/vienna14.glb'
const modelPath = path.join(ROOT, MODEL)

// Props whose loss is invisible: each one is read behind a null guard.
const REQUIRED = ['initialPoint0', 'exit0', 'continue0', 'invisibleWall0', 'floor0', 'ceiling0']

let glb: LoadedGlb
let panels: number[]

test.beforeAll(() => {
  test.skip(!fs.existsSync(modelPath), `${MODEL} not present — GLBs are gitignored, pull from R2`)
  glb = loadGlb(modelPath)
  const byName = Object.fromEntries(glb.names.map((n) => [n, true]))
  panels = getNodeIndices(byName, 'panel')
})

test('the props whose absence is silent are all present', () => {
  const missing = REQUIRED.filter((n) => !glb.names.includes(n))
  expect(missing, `dropped by the export:\n${missing.join('\n')}`).toEqual([])
})

test('nothing carries a duplicate suffix from being copied in Blender', () => {
  // `panel0.001` does not match ^panel\d+$, so it is never baked and never found.
  const copies = glb.names.filter((n) => /\.\d{3}$/.test(n))
  expect(copies, `rename these, they will never load:\n${copies.join('\n')}`).toEqual([])
})

test('panel indices have no leading zeros', () => {
  // `panel01` parses to 1 and collides with `panel1`.
  const padded = glb.names.filter((n) => /^(panel|panelFront|panelBack)0\d+$/.test(n))
  expect(padded, `two names resolving to one index:\n${padded.join('\n')}`).toEqual([])
})

test('the model actually has panels to check', () => {
  expect(panels.length, 'no panel<n> nodes found — has the model changed?').toBeGreaterThan(0)
})

test('every panel has both of its hangable faces', () => {
  // A box with one face has a side that silently cannot be hung on.
  const incomplete = panels.flatMap((i) =>
    ['panelFront', 'panelBack'].filter((p) => !glb.names.includes(`${p}${i}`)).map((p) => `${p}${i}`),
  )
  expect(incomplete, `missing faces:\n${incomplete.join('\n')}`).toEqual([])
})

test('the two faces of a panel look in opposite directions, away from the box', () => {
  // Duplicating the front face to make the back keeps the original's normal, so
  // both point the same way and the back's artworks hang facing INTO the panel.
  for (const i of panels) {
    const box = glb.boxOf(`panel${i}`)!
    const centre = [0, 1, 2].map((k) => (box.min[k] + box.max[k]) / 2)

    for (const side of ['panelFront', 'panelBack'] as const) {
      const normal = glb.normalOf(`${side}${i}`)
      expect(normal, `${side}${i} has no usable normal`).not.toBeNull()
      const faceBox = glb.boxOf(`${side}${i}`)!
      const faceCentre = [0, 1, 2].map((k) => (faceBox.min[k] + faceBox.max[k]) / 2)

      // Outward = the normal agrees with the direction from box centre to face.
      const outward = faceCentre.map((v, k) => v - centre[k])
      const dot = outward.reduce((acc, v, k) => acc + v * normal![k], 0)
      expect(dot, `${side}${i} faces INTO its panel — artworks would hang backwards`).toBeGreaterThan(0)
    }

    const front = glb.normalOf(`panelFront${i}`)!
    const back = glb.normalOf(`panelBack${i}`)!
    const opposed = front.reduce((acc, v, k) => acc + v * back[k], 0)
    expect(opposed, `panelFront${i} and panelBack${i} point the same way`).toBeLessThan(-0.99)
  }
})

test('every panel stands on the floor', () => {
  // A panel whose base sits even 13mm up reads as hovering.
  const floor = glb.boxOf('floor0')!
  for (const i of panels) {
    const box = glb.boxOf(`panel${i}`)!
    expect(
      Math.abs(box.min[1] - floor.max[1]),
      `panel${i} base is ${((box.min[1] - floor.max[1]) * 100).toFixed(1)}cm off the floor`,
    ).toBeLessThan(0.005)
  }
})

test('panels carry no material — the surface is generated in three.js', () => {
  const dressed = panels.filter((i) => glb.hasMaterial(`panel${i}`)).map((i) => `panel${i}`)
  expect(dressed, `dead weight in the GLB:\n${dressed.join('\n')}`).toEqual([])
})

test('panel numbering runs in blocks of ten, one block per room', () => {
  // Sequential numbering across rooms means adding a panel to room 0 renumbers
  // room 1, which orphans every artwork whose wallId points at the old name.
  const decadeByRoom = new Map<string, number>()
  for (const i of panels) {
    const room = glb.parentOf(`panel${i}`)
    expect(room, `panel${i} is not parented under a room Empty`).not.toBeNull()
    const decade = Math.floor(i / 10)
    const seen = decadeByRoom.get(room!)
    if (seen === undefined) decadeByRoom.set(room!, decade)
    else expect(decade, `${room} spans two decades — panel${i} breaks the block`).toBe(seen)
  }
  const decades = [...decadeByRoom.values()]
  expect(new Set(decades).size, 'two rooms share a numbering block').toBe(decades.length)
})

test('every panel face is parented under a room Empty, like the box', () => {
  // The faces must be flat siblings of the box, or world-baking moves the box
  // to the room offset and leaves its hangable faces behind.
  for (const i of panels) {
    const boxRoom = glb.parentOf(`panel${i}`)
    for (const side of ['panelFront', 'panelBack'] as const) {
      expect(glb.parentOf(`${side}${i}`), `${side}${i} is not a sibling of panel${i}`).toBe(boxRoom)
    }
  }
})
