import { test, expect } from '@playwright/test'

import {
  isTransientLoadError,
  quietCaughtErrors,
  retryLoads,
  withRetries,
} from '../src/components/scene/loadRetry'

/**
 * The room's loads survive a dropped connection, and an error a boundary in the scene handles is
 * not reported as an uncaught one (Sentry, 2026-11-15: an iPhone lost the space's model
 * mid-download, "Load failed"; a Redmi lost a bake's light map to its stall timer, "BodyStreamBuffer
 * was aborted"; both arrived as unhandled errors). No server, no WebGL.
 */

const networkError = () => new TypeError('Load failed')

type Callbacks = {
  onLoad: (data: string) => void
  onError?: (error: unknown) => void
}

/** A three-style loader that fails `failures` times with `error`, then loads. */
const flakyLoader = (failures: number, error: () => unknown) => {
  const loader = {
    calls: 0,
    load(
      url: string,
      onLoad: Callbacks['onLoad'],
      _onProgress?: unknown,
      onError?: Callbacks['onError'],
    ) {
      loader.calls++
      if (loader.calls <= failures) onError?.(error())
      else onLoad(`loaded ${url}`)
    },
  }
  return loader
}

const loadWith = (loader: ReturnType<typeof flakyLoader>) =>
  new Promise<{ data?: string; error?: unknown }>((resolve) =>
    loader.load(
      'model.glb',
      (data) => resolve({ data }),
      undefined,
      (error) => resolve({ error }),
    ),
  )

test.describe('which failed loads are tried again', () => {
  test('a dropped connection, a stall or a server error: yes', () => {
    expect(isTransientLoadError(new TypeError('Load failed'))).toBe(true)
    expect(isTransientLoadError(new TypeError('Failed to fetch'))).toBe(true)
    expect(
      isTransientLoadError(new DOMException('BodyStreamBuffer was aborted', 'AbortError')),
    ).toBe(true)
    expect(isTransientLoadError(new Error('stalled: nothing received for 30 s'))).toBe(true)
    expect(
      isTransientLoadError(
        new Error('fetch for "https://x/model.glb" responded with 503: Unavailable'),
      ),
    ).toBe(true)
    expect(isTransientLoadError(new Error('502 Bad Gateway'))).toBe(true)
  })

  test("the file isn't there, or isn't a file it can read: no", () => {
    expect(
      isTransientLoadError(
        new Error('fetch for "https://x/model.glb" responded with 404: Not Found'),
      ),
    ).toBe(false)
    expect(isTransientLoadError(new Error('404 Not Found'))).toBe(false)
    expect(isTransientLoadError(new Error('THREE.GLTFLoader: Unsupported asset.'))).toBe(false)
    expect(isTransientLoadError(undefined)).toBe(false)
  })
})

test.describe('a three loader that tries again', () => {
  test('a dropped connection twice, then the model: it loads, nothing fails', async () => {
    const loader = retryLoads(flakyLoader(2, networkError), [0, 0])
    expect(await loadWith(loader)).toEqual({ data: 'loaded model.glb' })
    expect(loader.calls).toBe(3)
  })

  test('still failing after its tries: the last error, once', async () => {
    const loader = retryLoads(flakyLoader(9, networkError), [0, 0])
    const result = await loadWith(loader)
    expect(result.error).toBeInstanceOf(TypeError)
    expect(loader.calls).toBe(3)
  })

  test('a 404 fails at once, never tried again', async () => {
    const notFound = () =>
      new Error('fetch for "https://x/model.glb" responded with 404: Not Found')
    const loader = retryLoads(flakyLoader(9, notFound), [0, 0])
    expect((await loadWith(loader)).error).toBeInstanceOf(Error)
    expect(loader.calls).toBe(1)
  })
})

test.describe('a download that tries again', () => {
  test('fails once, then arrives', async () => {
    let calls = 0
    const bytes = await withRetries(async () => {
      if (++calls === 1) throw new Error('stalled: nothing received for 30 s')
      return 'bytes'
    }, [0])
    expect(bytes).toBe('bytes')
    expect(calls).toBe(2)
  })

  test("past its tries, or a file that isn't there: the error", async () => {
    let calls = 0
    await expect(
      withRetries(async () => {
        calls++
        throw networkError()
      }, [0]),
    ).rejects.toThrow('Load failed')
    expect(calls).toBe(2)
    calls = 0
    await expect(
      withRetries(async () => {
        calls++
        throw new Error('404 Not Found')
      }, [0]),
    ).rejects.toThrow('404')
    expect(calls).toBe(1)
  })
})

test.describe("the scene's errors that a boundary caught", () => {
  test('are logged, not dispatched as uncaught errors', () => {
    const dispatched: unknown[] = []
    const root = { onCaughtError: (error: unknown) => dispatched.push(error) }
    expect(quietCaughtErrors(root)).toBe(true)
    const logged: unknown[] = []
    const error = console.error
    console.error = (...args: unknown[]) => logged.push(args)
    try {
      root.onCaughtError(new Error('Could not load floor-light.png: BodyStreamBuffer was aborted'))
    } finally {
      console.error = error
    }
    expect(dispatched).toEqual([])
    expect(logged).toHaveLength(1)
  })

  test('a root without the hook (another renderer version) is left as it is', () => {
    const root = {}
    expect(quietCaughtErrors(root)).toBe(false)
    expect(root).toEqual({})
    expect(quietCaughtErrors(undefined)).toBe(false)
  })
})
