import { assetUrl } from '@/lib/assetUrl'

/**
 * Where a space's model is loaded from, with an automatic fallback.
 *
 * R2 is the canonical home for every 3D asset (see `assetUrl`), and it stays
 * that way — this only decides what to do when R2 cannot deliver. Two failures
 * are covered, and they are genuinely different:
 *
 *  - **The object is not there.** A model referenced by a release that was
 *    never uploaded: the CDN answers 404 and the scene dies with
 *    "The 3D exhibition couldn't load". That is what took Vienna down on
 *    2026-09-20, when AR-150 shipped pointing at a `vienna14.glb` that had
 *    never reached the bucket.
 *  - **R2 cannot be reached at all.** The fetch rejects rather than answering.
 *
 * Either way the app's own origin serves the copy in `public/assets`, which
 * Vercel deploys with the build.
 *
 * ⚠️ AR-127 (2026-06-14) is the reason this is a FALLBACK and not a mirror.
 * 3D assets were deliberately removed from Vercel so that R2 is the single
 * canonical copy and there is nothing to keep in step. A file only belongs in
 * `public/assets` when it is standing in for an R2 object that is missing;
 * leave one there indefinitely and a stale local copy will silently shadow a
 * corrected remote one. The `.gitignore` rule on `*.glb` is what keeps that
 * honest — shipping one takes a deliberate negation.
 *
 * The probe is a single HEAD per model per page load, cached at module scope so
 * the many components that call `useGLTF` for the same space all agree on one
 * URL. They must: two different URLs would parse and upload the model twice.
 */

/** Resolved URL per bare asset path. */
const resolved = new Map<string, string>()

/** In-flight probes, so concurrent callers suspend on the same promise. */
const inflight = new Map<string, Promise<void>>()

/**
 * The URL to load a space model from — R2 when it answers, the app's own origin
 * when it does not.
 *
 * SUSPENDS on first call for a given path (it throws the probe promise), so it
 * must be called from inside a Suspense boundary. Every space already renders
 * inside one. Deliberately not named `use*`: it holds no state and is safe to
 * call anywhere in render, including conditionally.
 */
export const spaceGltfUrl = (path: string): string => {
  const hit = resolved.get(path)
  if (hit) return hit

  const remote = assetUrl(path)

  // `assetUrl` already chose the local copy — the dev-only per-file override.
  // Nothing to probe, and probing would defeat the point of the override.
  if (remote === path) {
    resolved.set(path, path)
    return path
  }

  const pending = inflight.get(path)
  if (pending) throw pending

  const probe = fetch(remote, { method: 'HEAD' })
    .then((res) => {
      resolved.set(path, res.ok ? remote : path)
      if (!res.ok) {
        console.warn(`[space asset] R2 returned ${res.status} for ${remote} — serving ${path}`)
      }
    })
    .catch((error) => {
      // Unreachable rather than absent: DNS, TLS, or a blocked IP range. The
      // local copy is the only thing that can render the room, so take it.
      resolved.set(path, path)
      console.warn(`[space asset] R2 unreachable for ${remote} — serving ${path}`, error)
    })
    .finally(() => {
      inflight.delete(path)
    })

  inflight.set(path, probe)
  throw probe
}

/**
 * The URL a model WOULD be loaded from, without suspending.
 *
 * For callers that only need to name the entry — `useGLTF.clear` is the one —
 * and must not suspend to do it. Before the probe has run this is the remote
 * URL, which is the right guess: it is what the loader will have cached in
 * every case except a fallback.
 */
export const spaceGltfUrlSync = (path: string): string => resolved.get(path) ?? assetUrl(path)

/**
 * Forget every resolution, so the next call probes again.
 *
 * The cache is deliberately for the lifetime of the page: a model that fell
 * back once should keep being served locally rather than flicker between two
 * sources. This exists for the cases where that is wrong — a test exercising
 * each branch, or a deliberate re-probe after R2 has been fixed without a
 * reload. Callers that also hold a parsed model should clear that too
 * (`useGLTF.clear`), or the old one stays in three's cache.
 */
export const clearSpaceAssetCache = (): void => {
  resolved.clear()
  inflight.clear()
}
