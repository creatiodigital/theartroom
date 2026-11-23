import { readFileSync } from 'node:fs'
import path from 'node:path'

import { test, expect } from '@playwright/test'

import {
  boundsToCm,
  checkGlb,
  glbPasses,
  readGlbJson,
  sizeCheck,
  type GlbFacts,
} from '../src/lib/objects/glb'
import { gatherServerGlbFacts } from '../src/lib/objects/glbFacts.server'

// Objects O4 (docs/objects, owner Q-O8): the GLB checker's rules, and the server's facts on a
// real file. Pure, no app server.

const good: GlbFacts = {
  sizeBytes: 6.4 * 1024 * 1024,
  isGlb: true,
  validator: { errors: 0, warnings: 0, messages: [] },
  externalUris: [],
  extensionsUsed: ['EXT_meshopt_compression'],
  triangles: 120_000,
  textures: [{ mimeType: 'image/webp', width: 2048, height: 2048 }],
  bounds: { min: [-0.19, 0, -0.155], max: [0.19, 0.64, 0.155] },
  opened: { ok: true, by: 'render' },
}
const details = { heightCm: 64, widthCm: 38, depthCm: 31 }
const status = (facts: GlbFacts, id: string) =>
  checkGlb(facts, details).find((r) => r.id === id)?.status

test('a clean model passes every check', () => {
  const rows = checkGlb(good, details)
  expect(rows.filter((r) => r.status !== 'pass')).toEqual([])
  expect(glbPasses(rows)).toBe(true)
})

test('blocking: not a glb, too large, validator errors, not opening, external files, quantized', () => {
  expect(status({ ...good, isGlb: false }, 'format')).toBe('fail')
  expect(status({ ...good, sizeBytes: 31 * 1024 * 1024 }, 'size')).toBe('fail')
  expect(
    status(
      {
        ...good,
        validator: {
          errors: 1,
          warnings: 0,
          messages: [{ code: 'X', message: 'Bad', severity: 0 }],
        },
      },
      'validator',
    ),
  ).toBe('fail')
  expect(status({ ...good, validator: null, validatorError: 'boom' }, 'validator')).toBe('fail')
  expect(status({ ...good, opened: { ok: false, by: 'render', error: 'x' } }, 'opened')).toBe(
    'fail',
  )
  expect(status({ ...good, externalUris: ['tex.png'] }, 'embedded')).toBe('fail')
  expect(
    status(
      { ...good, extensionsUsed: ['EXT_meshopt_compression', 'KHR_mesh_quantization'] },
      'quantization',
    ),
  ).toBe('fail')
  expect(status({ ...good, bounds: null }, 'realSize')).toBe('fail')
  expect(
    status(
      { ...good, textures: [{ mimeType: 'image/png', width: 9000, height: 9000 }] },
      'textures',
    ),
  ).toBe('fail')
  expect(glbPasses(checkGlb({ ...good, externalUris: ['x.bin'] }, details))).toBe(false)
})

test('warnings never block: compression, formats, big textures, triangles, size, base, centre', () => {
  expect(status({ ...good, extensionsUsed: [] }, 'compression')).toBe('warn')
  expect(
    status(
      { ...good, textures: [{ mimeType: 'image/jpeg', width: 1024, height: 1024 }] },
      'textures',
    ),
  ).toBe('warn')
  expect(
    status(
      { ...good, textures: [{ mimeType: 'image/ktx2', width: 6000, height: 6000 }] },
      'textures',
    ),
  ).toBe('warn')
  expect(status({ ...good, textures: [] }, 'textures')).toBe('warn')
  expect(status({ ...good, triangles: 900_000 }, 'triangles')).toBe('warn')
  const lifted = {
    ...good,
    bounds: { min: [-0.19, 0.03, -0.155], max: [0.19, 0.67, 0.155] },
  } as GlbFacts
  expect(status(lifted, 'base')).toBe('warn')
  const shifted = {
    ...good,
    bounds: { min: [0.1, 0, -0.155], max: [0.48, 0.64, 0.155] },
  } as GlbFacts
  expect(status(shifted, 'centre')).toBe('warn')
  const inMillimetres = {
    ...good,
    bounds: { min: [-190, 0, -155], max: [190, 640, 155] },
  } as GlbFacts
  expect(status(inMillimetres, 'realSize')).toBe('warn')
  expect(glbPasses(checkGlb({ ...good, extensionsUsed: [], triangles: 900_000 }, details))).toBe(
    true,
  )
})

test('size check: within 1 cm or 3 % matches; otherwise differs; no Details size is unknown', () => {
  expect(sizeCheck({ h: 64.4, w: 38, d: 31.6 }, details).status).toBe('match')
  expect(sizeCheck({ h: 70, w: 38, d: 31 }, details)).toEqual({
    status: 'differ',
    text: 'Differs from the size above (64 × 38 × 31 cm)',
  })
  expect(sizeCheck({ h: 64, w: 38, d: 31 }, { heightCm: 64 }).status).toBe('unknown')
  expect(boundsToCm(good.bounds)).toEqual({ h: 64, w: 38, d: 31 })
})

const sample = path.join(__dirname, '..', 'public/assets/furniture/eaton/eaton.glb')

test('reads a real .glb header; refuses truncated or foreign bytes', () => {
  const bytes = new Uint8Array(readFileSync(sample))
  expect(readGlbJson(bytes)?.asset?.version).toBe('2.0')
  expect(readGlbJson(bytes.subarray(0, bytes.byteLength - 10))).toBeNull()
  expect(readGlbJson(new TextEncoder().encode('{"asset":{"version":"2.0"}}'))).toBeNull()
})

test('server facts on a real file: validator, decoded bounds, textures', async () => {
  const facts = await gatherServerGlbFacts(new Uint8Array(readFileSync(sample)))
  expect(facts.isGlb).toBe(true)
  expect(facts.validator?.errors).toBe(0)
  expect(facts.opened.ok).toBe(true)
  expect(facts.triangles).toBe(132)
  expect(facts.textures).toEqual([{ mimeType: 'image/jpeg', width: 500, height: 368 }])
  expect(boundsToCm(facts.bounds)).toEqual({ h: 44.9, w: 185.3, d: 40.6 })
  const rows = checkGlb(facts, { heightCm: 44.9, widthCm: 185.3, depthCm: 40.6 })
  expect(glbPasses(rows)).toBe(true)
  expect(rows.find((r) => r.id === 'sizeCheck')?.status).toBe('pass')
})

test('server facts on broken bytes fail without throwing', async () => {
  const bytes = new Uint8Array(readFileSync(sample)).slice(0, 4000)
  const facts = await gatherServerGlbFacts(bytes)
  expect(glbPasses(checkGlb(facts, details))).toBe(false)
})
