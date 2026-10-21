import { test, expect, type APIRequestContext } from '@playwright/test'

import prisma from '@/lib/prisma'

test.use({ storageState: 'e2e/.auth/admin.json' })

const stamp = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

/**
 * AR-161 follow-up (Eduardo 2026-10-20): in a baked space the track lamps' beam and throw and
 * the ceiling color are the artist's again — saved, baked and fingerprinted. A new exhibition in
 * a baked space starts at the values its space's approved look was made with; a throw of 0 is
 * stored as no cut-off; each of the three makes the bake out of date.
 */

const create = async (request: APIRequestContext, spaceId: string) => {
  const s = stamp()
  const res = await request.post('/api/exhibitions', {
    data: {
      mainTitle: 'E2E Room Settings',
      handler: `e2e-room-settings-${s}`,
      url: `e2e-room-settings-${s}`,
      spaceId,
    },
  })
  expect(res.status(), `create failed: ${res.status()}`).toBe(201)
  return (await res.json()) as { id: string; url: string }
}

const room = (id: string) =>
  prisma.exhibition.findUniqueOrThrow({
    where: { id },
    select: { trackLampAngle: true, trackLampDistance: true, ceilingColor: true },
  })

test('a new exhibition in a baked space starts at its approved beam, throw and ceiling', async ({
  request,
}) => {
  const paris = await create(request, 'paris')
  const madrid = await create(request, 'madrid')
  const other = await create(request, 'not-a-baked-space')
  try {
    expect(await room(paris.id)).toEqual({
      trackLampAngle: 0.8,
      trackLampDistance: 0,
      ceilingColor: '#ffffff',
    })
    expect(await room(madrid.id)).toEqual({
      trackLampAngle: 0.45,
      trackLampDistance: 0,
      ceilingColor: '#ffffff',
    })
    // Any other space keeps the columns' defaults (today's realtime look).
    expect(await room(other.id)).toEqual({
      trackLampAngle: 0.45,
      trackLampDistance: 5,
      ceilingColor: '#ffffff',
    })
  } finally {
    await prisma.exhibition.deleteMany({ where: { id: { in: [paris.id, madrid.id, other.id] } } })
  }
})

test('beam, throw and ceiling save (0 = no cut-off) and each makes the bake out of date', async ({
  request,
}) => {
  const ex = await create(request, 'paris')
  const fingerprint = async () => {
    const res = await request.get(`/api/exhibitions/by-url/${ex.url}?mode=edit`)
    expect(res.ok()).toBe(true)
    return ((await res.json()) as { bakeFingerprint: string }).bakeFingerprint
  }
  const save = async (data: Record<string, unknown>) => {
    const res = await request.put(`/api/exhibitions/${ex.id}`, { data })
    expect(res.ok(), `save failed: ${res.status()}`).toBe(true)
  }
  try {
    const seen = new Set([await fingerprint()])
    for (const change of [
      { trackLampAngle: 0.5 },
      { trackLampDistance: 3 },
      { ceilingColor: '#e8e0cd' },
    ]) {
      await save(change)
      const now = await fingerprint()
      expect(seen.has(now), `${JSON.stringify(change)} left the fingerprint as it was`).toBe(false)
      seen.add(now)
    }
    expect(await room(ex.id)).toEqual({
      trackLampAngle: 0.5,
      trackLampDistance: 3,
      ceilingColor: '#e8e0cd',
    })

    // The throw: 0 (or below) is no cut-off; otherwise 1–10 m.
    await save({ trackLampDistance: 0 })
    expect((await room(ex.id)).trackLampDistance).toBe(0)
    await save({ trackLampDistance: 0.4 })
    expect((await room(ex.id)).trackLampDistance).toBe(1)
    await save({ trackLampDistance: 12 })
    expect((await room(ex.id)).trackLampDistance).toBe(10)
    await save({ trackLampDistance: -2 })
    expect((await room(ex.id)).trackLampDistance).toBe(0)
  } finally {
    await prisma.exhibition.deleteMany({ where: { id: ex.id } })
  }
})
