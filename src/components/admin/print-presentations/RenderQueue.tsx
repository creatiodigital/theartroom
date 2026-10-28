'use client'

import dynamic from 'next/dynamic'
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import type { StudioShot } from '@/components/printPresentation/studio/PrintStudio'
import type { PresentationInputs } from '@/lib/printPresentation/inputs'
import { PRESENTATION_WIDTH_PX } from '@/lib/printPresentation/record'

import { encodeShot, storeShot } from './capture'

import styles from './PrintPresentations.module.scss'

const PrintStudio = dynamic(
  () => import('@/components/printPresentation/studio/PrintStudio').then((m) => m.PrintStudio),
  { ssr: false },
)

export type RenderJob = { artworkId: string; inputs: PresentationInputs }

/** A work that hasn't produced its shot by then has stalled (a lost context, a texture that never
 *  arrives): it's reported and the queue moves on. A normal render takes a few seconds. */
const JOB_TIMEOUT_MS = 90_000

/** One work's studio: a scene that throws (a texture that won't load, no WebGL) fails that work only. */
class StudioBoundary extends Component<
  { onError: (error: Error) => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    this.props.onError(error)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

/**
 * Renders the jobs one at a time, off screen: one studio per work (a fresh canvas each, so the
 * WebGL context is released between works), captured, checked, encoded, stored. A work that fails
 * — a bad shot, a refused upload, a scene error, a stall — is reported and the queue moves on.
 * `stopping` lets the current work finish, then ends the queue.
 */
export function RenderQueue({
  jobs,
  stopping,
  onRowDone,
  onFinished,
}: {
  jobs: RenderJob[]
  stopping: boolean
  onRowDone: (artworkId: string, result: 'saved' | 'failed', error?: string) => void
  onFinished: () => void
}) {
  const [index, setIndex] = useState(0)
  const job = jobs[index]
  // The work in hand (its id), and whether its shot is being stored. A late result for a work
  // already given up on (timed out) is ignored.
  const current = useRef<string | null>(null)
  const busy = useRef(false)

  const finish = useCallback(
    (artworkId: string, result: 'saved' | 'failed', error?: string) => {
      if (current.current !== artworkId) return
      current.current = null
      busy.current = false
      onRowDone(artworkId, result, error)
      setIndex((i) => i + 1)
    },
    [onRowDone],
  )

  useEffect(() => {
    if (!job || (stopping && !busy.current)) onFinished()
  }, [job, stopping, onFinished])

  useEffect(() => {
    if (!job) return
    current.current = job.artworkId
    const timer = setTimeout(
      () => finish(job.artworkId, 'failed', 'Timed out: the render never finished'),
      JOB_TIMEOUT_MS,
    )
    return () => clearTimeout(timer)
  }, [job, finish])

  const onReady = useCallback(
    async (shot: StudioShot) => {
      if (!job || busy.current || current.current !== job.artworkId) return
      busy.current = true
      try {
        const files = await encodeShot(shot.canvas, shot.window)
        await storeShot(
          job.artworkId,
          job.inputs.fingerprint,
          shot.window,
          files,
          window.location.origin,
        )
        finish(job.artworkId, 'saved')
      } catch (err) {
        finish(job.artworkId, 'failed', err instanceof Error ? err.message : String(err))
      }
    },
    [job, finish],
  )

  if (!job || stopping) return null
  return (
    // Off screen, never display: none — the canvas must have a real size to render.
    <div className={styles.offscreen} aria-hidden="true">
      <StudioBoundary
        key={job.artworkId}
        onError={(error) => finish(job.artworkId, 'failed', `The scene failed: ${error.message}`)}
      >
        <PrintStudio
          ratio={job.inputs.ratio}
          mode={job.inputs.mode}
          edition={job.inputs.edition}
          frame={job.inputs.frame}
          seed={job.inputs.seed}
          widthPx={PRESENTATION_WIDTH_PX.large}
          onReady={onReady}
        />
      </StudioBoundary>
    </div>
  )
}
