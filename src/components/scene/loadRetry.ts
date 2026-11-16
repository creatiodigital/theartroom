/**
 * The room's loads survive a dropped connection (Sentry, 2026-11-15: an iPhone on Mobile Safari
 * lost the space's model mid-download — "Load failed", four minutes after its 200, the phone likely
 * put away — and a Redmi on a slow line lost a bake's light map to its stall timer, "BodyStreamBuffer
 * was aborted"). A dropped connection, a stall or a server error is tried again; the server saying
 * the file isn't there (4xx), or a file that can't be read, is not. The scene's textures already
 * do this their own way (`RetryTextureLoader`).
 */

/** Waits before each further try (ms): the model gets two more, after 1 s and then 3 s. */
export const LOAD_RETRY_DELAYS_MS: readonly number[] = [1000, 3000]

/**
 * Whether a failed load is worth trying again: the network (a `TypeError` from `fetch`, an abort,
 * our own stall timer) or the server failing (5xx). three's `FileLoader` words an HTTP error as
 * `fetch for "…" responded with 404: Not Found`, `fetchBytes` as `404 Not Found`.
 */
export const isTransientLoadError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  const { name, message } = error as { name?: unknown; message?: unknown }
  const text = typeof message === 'string' ? message : ''
  if (/(responded with |^)5\d\d\b/.test(text)) return true
  if (/(responded with |^)4\d\d\b/.test(text)) return false
  return (
    name === 'TypeError' ||
    name === 'AbortError' ||
    /stalled|aborted|network|load failed|failed to fetch/i.test(text)
  )
}

/** A three loader's callback `load`, as `retryLoads` drives it. */
type CallbackLoader = {
  load(
    url: string,
    onLoad: (data: unknown) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): unknown
}

/**
 * A three loader whose `load` tries again after a transient failure (`isTransientLoadError`),
 * waiting `delays` between tries; only the last error reaches `onError`. For drei's
 * `useGLTF.preload(url, draco, meshopt, extendLoader)`.
 */
export const retryLoads = <L extends { load: (...args: never[]) => unknown }>(
  loader: L,
  delays: readonly number[] = LOAD_RETRY_DELAYS_MS,
): L => {
  const target = loader as unknown as CallbackLoader
  const load = target.load.bind(target)
  target.load = (url, onLoad, onProgress, onError) => {
    let tries = 0
    const attempt = (): unknown =>
      load(url, onLoad, onProgress, (error) => {
        if (tries < delays.length && isTransientLoadError(error)) {
          setTimeout(attempt, delays[tries++])
        } else onError?.(error)
      })
    return attempt()
  }
  return loader
}

/** `run` again after a transient failure, waiting `delays` between tries; else its error. */
export const withRetries = async <T>(
  run: () => Promise<T>,
  delays: readonly number[] = LOAD_RETRY_DELAYS_MS,
): Promise<T> => {
  for (let tries = 0; ; tries++) {
    try {
      return await run()
    } catch (error) {
      if (tries >= delays.length || !isTransientLoadError(error)) throw error
      await new Promise((resolve) => setTimeout(resolve, delays[tries]))
    }
  }
}

/**
 * ⚠️ The 3D scene's own React root (react-three-fiber 9) hands React `reportError` for its
 * `onCaughtError`: every error a boundary inside the scene catches — and handles: the bake's
 * `StoredBakeBoundary` falls back to today's look and reports it, the street view and the HDRI
 * report a warning — is also dispatched as an uncaught error, which Sentry files as unhandled. Logged
 * here instead (uncaught errors keep `reportError`). Takes the root `_roots` holds for the canvas;
 * a renderer without the hook is left as it is (true when the hook was replaced).
 */
export const quietCaughtErrors = (root: unknown): boolean => {
  const hooks = root as { onCaughtError?: unknown } | null | undefined
  if (!hooks || typeof hooks.onCaughtError !== 'function') return false
  hooks.onCaughtError = (error: unknown) => console.error('[scene] caught by a boundary:', error)
  return true
}
