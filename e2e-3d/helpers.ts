import fs from 'node:fs'
import path from 'node:path'

import { expect, type Page, type Request } from '@playwright/test'

import prisma from '@/lib/prisma'

import { fixtures } from '../e2e/fixtures'

/**
 * The 3D spaces, read from the scene's own list (`spaceComponents` in
 * src/components/scene/constants.tsx), so a space added there is covered from that day on.
 * Read as text: importing the module would pull React and `next/dynamic` into the runner.
 */
export function spaceKeys(): string[] {
  const file = path.join(__dirname, '..', 'src', 'components', 'scene', 'constants.tsx')
  const block = fs
    .readFileSync(file, 'utf8')
    .match(/export const spaceComponents = \{([\s\S]*?)\n\}/)
  if (!block) throw new Error(`spaceComponents not found in ${file}`)
  const keys = [...block[1].matchAll(/^\s*(\w+):\s*dynamic\(/gm)].map((m) => m[1])
  if (keys.length === 0) throw new Error(`No spaces listed in spaceComponents (${file})`)
  return keys
}

export type Show = { space: string; title: string; path: string; works: number }

/**
 * The show a space is tested with: the fixture artist's published exhibition in that space, its
 * room published too — the fixture exhibition when it is in this space, else the one with the
 * most works (the heaviest real room). Read-only, like everything in this suite.
 */
export async function showIn(space: string): Promise<Show> {
  const shows = await prisma.exhibition.findMany({
    where: {
      spaceId: space,
      published: true,
      spacePublished: true,
      user: { handler: fixtures.artistSlug },
    },
    select: {
      url: true,
      mainTitle: true,
      user: { select: { handler: true } },
      _count: { select: { exhibitionArtworks: true } },
    },
  })
  if (shows.length === 0) {
    throw new Error(
      `No published exhibition with a published 3D room in "${space}" for ${fixtures.artistSlug} ` +
        'in this database: publish one (and its space) to test this space.',
    )
  }
  const show =
    shows.find((s) => s.url === fixtures.exhibitionSlug) ??
    [...shows].sort((a, b) => b._count.exhibitionArtworks - a._count.exhibitionArtworks)[0]
  return {
    space,
    title: show.mainTitle ?? show.url,
    path: `/exhibitions/${show.user.handler}/${show.url}/visit`,
    works: show._count.exhibitionArtworks,
  }
}

/** A file the room asked for: models, textures, images, video, sound, decoders, bake maps. */
export type FileRequest = {
  url: string
  /** Host and path, without the query: the same file asked for twice under two queries is one file. */
  file: string
  resourceType: string
  /** Null while no response came. */
  status: number | null
  /** Why it never arrived (not an abort: video and sound cancel ranges they no longer need). */
  failure: string | null
}

const FILE_EXTENSION =
  /\.(glb|gltf|bin|ktx2|basis|wasm|js|hdr|exr|png|jpe?g|webp|avif|gif|svg|mp4|webm|mov|m4v|mp3|m4a|aac|ogg|oga|wav|json|woff2?)$/i
/** Routes that serve stored files (local backend), the only API paths that are files. */
const FILE_ROUTES = ['/api/bake-files/', '/api/presentation-files/']

function isFile(url: URL): boolean {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
  // The app's own code, fonts and RSC: Next's business, not the room's.
  if (url.pathname.startsWith('/_next/')) return false
  if (url.pathname.startsWith('/api/')) return FILE_ROUTES.some((r) => url.pathname.startsWith(r))
  return FILE_EXTENSION.test(url.pathname)
}

export type Visit = {
  show: Show
  page: Page
  /** The loader finished and stepped aside. False: why not. */
  revealed: true | string
  revealedAfterMs: number | null
  pageErrors: string[]
  consoleErrors: string[]
  files: FileRequest[]
}

/** How long a cold room may take: every file of the heaviest show, then its bake going on. */
const REVEAL_TIMEOUT_MS = 180_000
/** After the reveal, files still trickling in: wait until none has been asked for this long… */
const QUIET_MS = 2_000
/** …but no longer than this (a room with video keeps streaming). */
const SETTLE_CAP_MS = 15_000

/**
 * One cold first visit of a show's room, recorded: every file asked for and what came back,
 * uncaught errors and console errors, and whether the room was revealed. The page stays open for
 * the tests to look at.
 */
export async function visitRoom(page: Page, show: Show): Promise<Visit> {
  const pageErrors: string[] = []
  const consoleErrors: string[] = []
  const requests: Request[] = []
  const status = new Map<Request, number>()
  const failure = new Map<Request, string>()
  let lastFileAt = Date.now()

  // `<Analytics />` and `<SpeedInsights />` (app/layout.tsx) load their scripts from /_vercel/,
  // which only Vercel serves: a local `next start` answers 404, read here as console errors and a
  // file that never arrived. Not the room's; answered with an empty script (and nothing is sent
  // to Vercel). Dev builds never load them.
  await page.route('**/_vercel/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }),
  )
  page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('request', (request) => {
    if (request.method() !== 'GET' || !isFile(new URL(request.url()))) return
    requests.push(request)
    lastFileAt = Date.now()
  })
  page.on('response', (response) => status.set(response.request(), response.status()))
  page.on('requestfailed', (request) => {
    const reason = request.failure()?.errorText ?? 'failed'
    if (!/ERR_ABORTED/i.test(reason)) failure.set(request, reason)
  })

  const started = Date.now()
  let revealed: true | string = true
  let revealedAfterMs: number | null = null
  try {
    await page.goto(show.path)
    // The canvas first (the page is live, WebGL is on), then the loader gone: the room is shown —
    // or the scene failed and its message took over (a test checks for that message).
    await expect(page.locator('canvas').first()).toBeAttached({ timeout: 60_000 })
    await expect(page.getByTestId('monogram-loader')).toHaveCount(0, {
      timeout: REVEAL_TIMEOUT_MS,
    })
    revealedAfterMs = Date.now() - started
  } catch (error) {
    revealed = error instanceof Error ? error.message.split('\n')[0] : String(error)
  }

  // Files asked for after the reveal (late textures, video) count too.
  const settleStart = Date.now()
  while (Date.now() - lastFileAt < QUIET_MS && Date.now() - settleStart < SETTLE_CAP_MS) {
    await page.waitForTimeout(250)
  }

  const files = requests.map((request): FileRequest => {
    const url = new URL(request.url())
    return {
      url: request.url(),
      file: `${url.host}${url.pathname}`,
      resourceType: request.resourceType(),
      status: status.get(request) ?? null,
      failure: failure.get(request) ?? null,
    }
  })
  return { show, page, revealed, revealedAfterMs, pageErrors, consoleErrors, files }
}

/**
 * Files asked for more than once, as "N× host/path". Video and sound are left out: a player
 * streams one file in many range requests by design.
 */
export function repeatedFiles(files: FileRequest[]): string[] {
  const byFile = new Map<string, FileRequest[]>()
  for (const f of files) {
    if (f.resourceType === 'media' || f.status === 206) continue
    byFile.set(f.file, [...(byFile.get(f.file) ?? []), f])
  }
  return [...byFile]
    .filter(([, asked]) => asked.length > 1)
    .map(([file, asked]) => {
      const queries = new Set(asked.map((a) => new URL(a.url).search || '(no query)'))
      return `${asked.length}× ${file}${queries.size > 1 ? `  [${[...queries].join(' | ')}]` : ''}`
    })
}

/** Files that never arrived: an error status, or a failure other than an abort. */
export function missingFiles(files: FileRequest[]): string[] {
  return files
    .filter((f) => f.failure !== null || (f.status !== null && f.status >= 400))
    .map((f) => `${f.failure ?? f.status} ${f.file}`)
}
