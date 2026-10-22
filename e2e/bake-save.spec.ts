import { test, expect } from '@playwright/test'
import { Color, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three'

import { BAKER_VERSION, isBakeRecord, type BakeDraft } from '@/lib/bake/bakeRecord'
import {
  BAKE_CACHE_CONTROL,
  bakeMapFile,
  bakeUploadHeaders,
  saveBake,
  type SaveBakeOptions,
} from '@/lib/bake/bakeUpload'
import { bakePageUrl } from '@/lib/bake/bakePageUrl'
import { buildBakeDraft } from '@/components/scene/bake/bakeOutput'
import { artworkUserData } from '@/components/scene/spaces/objects/Display/artworkId'

// AR-161 Task 15 — the admin's bake leaves the browser all or nothing: every map uploaded, then
// the record saved; a failure (or a closed tab) anywhere before saves nothing.

const ORIGIN = 'http://localhost:3001'
const EXHIBITION = 'ex-1'

// --- File names and upload headers --------------------------------------------------------------

test('map files are named receiver-kind.png, within the server’s file rule', () => {
  for (const receiver of ['wall', 'ceiling', 'floor', 'props', 'panels', 'cards'] as const)
    for (const kind of ['light', 'direction'] as const) {
      const file = bakeMapFile(receiver, kind)
      expect(file).toBe(`${receiver}-${kind}.png`)
      expect(file).toMatch(/^[a-z-]+\.png$/)
    }
})

test('an upload always says image/png; only a presigned (other-origin) URL gets the signed cache header', () => {
  expect(BAKE_CACHE_CONTROL).toBe('public, max-age=31536000, immutable')
  const local = `/api/bake-files/exhibitions/${EXHIBITION}/bakes/b1/wall-light.png`
  expect(bakeUploadHeaders(local, ORIGIN)).toEqual({ 'Content-Type': 'image/png' })
  expect(bakeUploadHeaders(`${ORIGIN}${local}`, ORIGIN)).toEqual({ 'Content-Type': 'image/png' })
  const r2 =
    'https://bucket.r2.cloudflarestorage.com/dev/exhibitions/ex-1/bakes/b1/wall-light.png?X-Amz-Signature=abc'
  expect(bakeUploadHeaders(r2, ORIGIN)).toEqual({
    'Content-Type': 'image/png',
    'Cache-Control': BAKE_CACHE_CONTROL,
  })
})

// --- Bake / review page links -------------------------------------------------------------------

test('bake and review links keep every other query parameter and drop the other mode', () => {
  expect(bakePageUrl('?utm_source=mail&lang=en&bake=1', 'review')).toBe(
    '?utm_source=mail&lang=en&review=1',
  )
  expect(bakePageUrl('?review=1&utm_source=mail', 'bake')).toBe('?utm_source=mail&bake=1')
  expect(bakePageUrl('', 'bake')).toBe('?bake=1')
  expect(bakePageUrl('?bake=1', 'bake')).toBe('?bake=1')
  expect(bakePageUrl('utm_source=mail', 'review')).toBe('?utm_source=mail&review=1')
})

// --- The record ---------------------------------------------------------------------------------

const image = (id: string) => {
  const mesh = new Mesh(new PlaneGeometry(1, 1), new MeshStandardMaterial())
  mesh.name = 'artworkImage'
  mesh.userData = artworkUserData(id)
  return mesh
}

const MAPS = [
  {
    receiver: 'wall' as const,
    kind: 'light' as const,
    width: 4,
    height: 4,
    encoding: { format: 'log16' as const, max: 9, knee: 9 / 4096 },
  },
  {
    receiver: 'wall' as const,
    kind: 'direction' as const,
    width: 4,
    height: 4,
    encoding: { format: 'signed16' as const, max: 1, knee: 0 },
  },
]

const draftFor = (bakeId: string, urls: Record<string, string>): BakeDraft =>
  buildBakeDraft({
    id: bakeId,
    fingerprint: 'f'.repeat(64),
    unwrap: { hash: 'abcd1234', stats: [[3, 1, 2, 3, 4]] },
    maps: MAPS.map((map) => ({ ...map, url: urls[bakeMapFile(map.receiver, map.kind)]! })),
    artBounce: new Map([[image('art-1'), new Color(0.5, 0.25, 0.125)]]),
    camera: { exposure: 0.524, whiteBalance: [0.933, 1.01, 1.135] },
    ms: 98765,
  })

test('the draft record carries the room, the maps and the camera — and leaves bakedBy/reviewedAt to the server', () => {
  const camera: [number, number, number] = [0.933, 1.01, 1.135]
  const draft = buildBakeDraft({
    id: 'b1',
    fingerprint: 'fp',
    unwrap: { hash: 'h', stats: [[1, 2, 3, 4, 5]] },
    maps: MAPS.map((map) => ({ ...map, url: `/x/${bakeMapFile(map.receiver, map.kind)}` })),
    artBounce: new Map([
      [image('art-1'), new Color(0.5, 0.25, 0.125)],
      [new Mesh(), new Color(1, 1, 1)], // no artwork id: not stored
    ]),
    camera: { exposure: 0.524, whiteBalance: camera },
    ms: 1234,
  })
  expect(draft).not.toHaveProperty('bakedBy')
  expect(draft).not.toHaveProperty('reviewedAt')
  expect(draft.bakerVersion).toBe(BAKER_VERSION)
  expect(draft.fingerprint).toBe('fp')
  expect(draft.unwrapHash).toBe('h')
  expect(draft.artLight).toEqual({ 'art-1': [0.5, 0.25, 0.125] })
  expect(draft.camera).toEqual({ exposure: 0.524, whiteBalance: camera })
  expect(draft.camera.whiteBalance).not.toBe(camera)
  expect(draft.maps.map((m) => m.url)).toEqual(['/x/wall-light.png', '/x/wall-direction.png'])
  expect(Number.isNaN(Date.parse(draft.bakedAt))).toBe(false)
  // What the server stores: the same, with its own bakedBy and reviewedAt.
  expect(
    isBakeRecord(JSON.parse(JSON.stringify({ ...draft, bakedBy: 'u', reviewedAt: null }))),
  ).toBe(true)
})

// --- Saving: all or nothing ---------------------------------------------------------------------

type Call = { method: string; url: string; headers: Record<string, string>; body: unknown }

/** A fake server: the uploads route, a file store (local or R2-like) and the bake route. */
const fakeServer = (opts: {
  backend: 'local' | 'r2'
  failUpload?: string
  dropUpload?: string
  bakeStatus?: number
  onUpload?: () => void
}) => {
  const calls: Call[] = []
  const stored = new Map<string, number>()
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    const headers = { ...(init?.headers as Record<string, string> | undefined) }
    init?.signal?.throwIfAborted()
    const body =
      typeof init?.body === 'string'
        ? JSON.parse(init.body)
        : init?.body instanceof Blob
          ? init.body.size
          : null
    calls.push({ method, url, headers, body })
    if (method === 'POST' && url === `/api/exhibitions/${EXHIBITION}/bake/uploads`) {
      const files = (body as { files: string[] }).files.filter((f) => f !== opts.dropUpload)
      const bakeId = 'bake-123'
      return Response.json({
        bakeId,
        uploads: files.map((file) => {
          const key = `exhibitions/${EXHIBITION}/bakes/${bakeId}/${file}`
          return opts.backend === 'local'
            ? { file, url: `/api/bake-files/${key}`, publicUrl: `/api/bake-files/${key}` }
            : {
                file,
                url: `https://acct.r2.cloudflarestorage.com/bucket/dev/${key}?X-Amz-Signature=s`,
                publicUrl: `https://assets.example.com/dev/${key}`,
              }
        }),
      })
    }
    if (method === 'PUT' && url.includes('/bakes/bake-123/')) {
      opts.onUpload?.()
      const file = url.split('?')[0]!.split('/').pop()!
      if (file === opts.failUpload) return new Response('nope', { status: 500 })
      stored.set(file, body as number)
      return new Response(null, { status: 200 })
    }
    if (method === 'PUT' && url === `/api/exhibitions/${EXHIBITION}/bake`) {
      const status = opts.bakeStatus ?? 200
      if (status !== 200) return Response.json({ error: 'Invalid bake record' }, { status })
      return Response.json({ ...(body as object), bakedBy: 'admin-1', reviewedAt: null })
    }
    return new Response('unexpected', { status: 404 })
  }) as typeof fetch
  return { calls, stored, fetchImpl }
}

const FILES = [
  { file: 'wall-light.png', blob: new Blob([new Uint8Array(300)], { type: 'image/png' }) },
  { file: 'wall-direction.png', blob: new Blob([new Uint8Array(100)], { type: 'image/png' }) },
]

const options = (
  fetchImpl: typeof fetch,
  extra: Partial<SaveBakeOptions> = {},
): SaveBakeOptions => ({
  exhibitionId: EXHIBITION,
  files: FILES,
  record: draftFor,
  origin: ORIGIN,
  fetch: fetchImpl,
  ...extra,
})

const bakeSaves = (calls: Call[]) =>
  calls.filter((c) => c.method === 'PUT' && c.url === `/api/exhibitions/${EXHIBITION}/bake`)

test('every map is uploaded, then the record is saved last, pointing at the uploaded files', async () => {
  const server = fakeServer({ backend: 'local' })
  const progress: number[] = []
  const saved = await saveBake(options(server.fetchImpl, { onProgress: (f) => progress.push(f) }))

  expect(server.calls[0]).toMatchObject({
    method: 'POST',
    url: `/api/exhibitions/${EXHIBITION}/bake/uploads`,
    body: { files: ['wall-light.png', 'wall-direction.png'] },
  })
  const uploads = server.calls.filter((c) => c.url.startsWith('/api/bake-files/'))
  expect(uploads.map((c) => c.body)).toEqual([300, 100])
  for (const upload of uploads) expect(upload.headers).toEqual({ 'Content-Type': 'image/png' })
  expect(server.stored.size).toBe(2)

  const last = server.calls.at(-1)!
  expect(last.method).toBe('PUT')
  expect(last.url).toBe(`/api/exhibitions/${EXHIBITION}/bake`)
  const body = last.body as Record<string, unknown>
  expect(body).not.toHaveProperty('bakedBy')
  expect(body.id).toBe('bake-123')
  expect((body.maps as { url: string }[]).map((m) => m.url)).toEqual([
    `/api/bake-files/exhibitions/${EXHIBITION}/bakes/bake-123/wall-light.png`,
    `/api/bake-files/exhibitions/${EXHIBITION}/bakes/bake-123/wall-direction.png`,
  ])
  expect(saved.id).toBe('bake-123')
  expect(saved.bakedBy).toBe('admin-1')
  expect(isBakeRecord(saved)).toBe(true)

  // Never backwards, and full only once saved.
  for (let i = 1; i < progress.length; i++)
    expect(progress[i]).toBeGreaterThanOrEqual(progress[i - 1]!)
  expect(progress.at(-1)).toBe(1)
  expect(progress.slice(0, -1).every((f) => f < 1)).toBe(true)
})

test('R2: each presigned PUT carries the signed Cache-Control; the record points at the public URLs', async () => {
  const server = fakeServer({ backend: 'r2' })
  await saveBake(options(server.fetchImpl))
  const uploads = server.calls.filter((c) => c.url.includes('r2.cloudflarestorage.com'))
  expect(uploads).toHaveLength(2)
  for (const upload of uploads)
    expect(upload.headers).toEqual({
      'Content-Type': 'image/png',
      'Cache-Control': BAKE_CACHE_CONTROL,
    })
  const body = bakeSaves(server.calls)[0]!.body as { maps: { url: string }[] }
  expect(body.maps[0]!.url).toBe(
    `https://assets.example.com/dev/exhibitions/${EXHIBITION}/bakes/bake-123/wall-light.png`,
  )
})

test('a failed upload saves nothing', async () => {
  const server = fakeServer({ backend: 'local', failUpload: 'wall-direction.png' })
  await expect(saveBake(options(server.fetchImpl))).rejects.toThrow(/wall-direction\.png/)
  expect(bakeSaves(server.calls)).toHaveLength(0)
})

test('an upload URL missing for a map saves nothing (and uploads nothing)', async () => {
  const server = fakeServer({ backend: 'local', dropUpload: 'wall-light.png' })
  await expect(saveBake(options(server.fetchImpl))).rejects.toThrow(/wall-light\.png/)
  expect(server.calls.filter((c) => c.method === 'PUT')).toHaveLength(0)
})

test('a closed page (aborted) mid-upload saves nothing', async () => {
  const controller = new AbortController()
  const server = fakeServer({ backend: 'local', onUpload: () => controller.abort() })
  await expect(saveBake(options(server.fetchImpl, { signal: controller.signal }))).rejects.toThrow()
  expect(bakeSaves(server.calls)).toHaveLength(0)
})

test('a refused record is an error, with the server’s reason', async () => {
  const server = fakeServer({ backend: 'local', bakeStatus: 400 })
  await expect(saveBake(options(server.fetchImpl))).rejects.toThrow(/Invalid bake record/)
})
