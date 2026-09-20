import { test, expect } from '@playwright/test'

import {
  clearSpaceAssetCache,
  spaceGltfUrl,
  spaceGltfUrlSync,
} from '../src/components/scene/spaceAsset'

// R2 is the canonical home for every space model. This is what happens when it
// cannot deliver one — which is not hypothetical: on 2026-09-20 a release
// shipped pointing at a `vienna14.glb` that had never been uploaded, the CDN
// answered 404, and the whole Vienna scene died with "The 3D exhibition
// couldn't load".
//
// Two distinct failures, same outcome: serve the copy Vercel deploys.
//
// `spaceGltfUrl` suspends by throwing its probe promise, so each case here
// drives it the way React would — call, catch the throw, await, call again.

const REMOTE = 'https://assets.theartroom.gallery/app'
const PATH = '/assets/spaces/vienna/vienna14.glb?v=1'

type Fetch = typeof globalThis.fetch

/** Drive the suspending resolver to completion, as a Suspense boundary would. */
const resolveThroughSuspense = async (
  fn: (p: string) => string,
  path: string,
): Promise<string> => {
  try {
    return fn(path)
  } catch (thrown) {
    await (thrown as Promise<void>)
    return fn(path)
  }
}

// The resolver caches at module scope on purpose — one probe per model per
// page — so each case clears it and swaps in its own fetch.
const realFetch = globalThis.fetch

const withFetch = (impl: Fetch) => {
  clearSpaceAssetCache()
  globalThis.fetch = impl
}

test.afterEach(() => {
  globalThis.fetch = realFetch
  clearSpaceAssetCache()
})

test('R2 serving the model is used as-is', async () => {
  const calls: string[] = []
  withFetch((async (url: string) => {
    calls.push(String(url))
    return { ok: true, status: 200 } as Response
  }) as unknown as Fetch)

  const url = await resolveThroughSuspense(spaceGltfUrl, PATH)
  expect(url, 'a healthy R2 must still be the source').toBe(`${REMOTE}${PATH}`)
  expect(calls, 'the probe should ask R2, once').toEqual([`${REMOTE}${PATH}`])
})

test('a model missing from R2 falls back to the app origin', async () => {
  // The 2026-09-20 case: the object was never uploaded, so the CDN 404s.
  withFetch((async () => ({ ok: false, status: 404 }) as Response) as unknown as Fetch)

  const url = await resolveThroughSuspense(spaceGltfUrl, PATH)
  expect(url, '404 from R2 must fall back to Vercel, not kill the scene').toBe(PATH)
})

test('an unreachable R2 falls back to the app origin', async () => {
  // Different failure: the fetch rejects rather than answering. A blocked IP
  // range does this — ETIMEDOUT on connect, no response at all.
  withFetch((async () => {
    throw Object.assign(new Error('connect ETIMEDOUT 172.64.190.1:443'), { code: 'ETIMEDOUT' })
  }) as unknown as Fetch)

  const url = await resolveThroughSuspense(spaceGltfUrl, PATH)
  expect(url, 'an unreachable R2 must fall back, not reject').toBe(PATH)
})

test('the probe runs once and every caller agrees on one url', async () => {
  // Two urls for one model means the loader parses and uploads it twice.
  let probes = 0
  withFetch((async () => {
    probes += 1
    return { ok: true, status: 200 } as Response
  }) as unknown as Fetch)

  const first = await resolveThroughSuspense(spaceGltfUrl, PATH)
  const second = spaceGltfUrl(PATH)
  const third = spaceGltfUrl(PATH)

  expect(probes, 'the HEAD must be cached at module scope').toBe(1)
  expect(second).toBe(first)
  expect(third).toBe(first)
})

test('the sync reader names the resolved entry after a fallback', async () => {
  // useGLTF.clear() uses this. Clearing the R2 url after a fallback would miss
  // the entry the loader actually cached.
  withFetch((async () => ({ ok: false, status: 404 }) as Response) as unknown as Fetch)

  expect(spaceGltfUrlSync(PATH), 'before the probe, the remote url is the right guess').toBe(
    `${REMOTE}${PATH}`,
  )
  await resolveThroughSuspense(spaceGltfUrl, PATH)
  expect(spaceGltfUrlSync(PATH), 'after a fallback it must name the local copy').toBe(PATH)
})
