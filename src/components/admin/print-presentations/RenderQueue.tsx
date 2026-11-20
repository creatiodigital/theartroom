'use client'

import dynamic from 'next/dynamic'
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import type { PhotoRenderer } from '@/components/printPresentation/photoViews/PhotoRenderer'
import { encodePhoto } from '@/components/printPresentation/photoViews/photoCapture'
import type { StudioShot } from '@/components/printPresentation/studio/PrintStudio'
import type { PresentationInputs } from '@/lib/printPresentation/inputs'
import type { PhotoInputs } from '@/lib/printPresentation/photoInputs'
import {
  PHOTO_VIEWS,
  PRESENTATION_WIDTH_PX,
  type PhotoViewKind,
  type PresentationSize,
} from '@/lib/printPresentation/record'

import { encodeShot, storeRender } from './capture'

import styles from './PrintPresentations.module.scss'

const PrintStudio = dynamic(
  () => import('@/components/printPresentation/studio/PrintStudio').then((m) => m.PrintStudio),
  { ssr: false },
)

export type RenderJob = {
  artworkId: string
  inputs: PresentationInputs
  /** Its three photo views' inputs; null for a work without a web image. */
  photo: PhotoInputs | null
  /** The copy it pencils (the real next unsold one); null for works that carry none. */
  copy: number | null
}

/** A work that hasn't produced its shots by then has stalled (a lost context, a texture that
 *  never arrives): it's reported and the queue moves on. A normal render takes a few seconds. */
const JOB_TIMEOUT_MS = 180_000

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    // The artwork goes into the photos' WebGL texture: it must be fetched with CORS.
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("The artwork's image did not load"))
    img.src = src
  })

/** A work's three photo views on `renderer`, rendered and encoded (both sizes each). */
async function renderPhotoViews(renderer: PhotoRenderer, photo: PhotoInputs) {
  const image = await loadImage(photo.imageUrl)
  const sheet = {
    ...photo.sheet,
    number:
      photo.numbered && photo.copy !== null && photo.edition !== null
        ? `${photo.copy}/${photo.edition}`
        : null,
  }
  const out = {} as Record<PhotoViewKind, Record<PresentationSize, Blob>>
  for (const view of PHOTO_VIEWS) {
    const canvas = await renderer.render({ image, sheet, seed: photo.seed, view })
    out[view] = await encodePhoto(canvas)
  }
  return out
}

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
  // One photo renderer (one WebGL context) for the whole batch, freed when the queue unmounts.
  // Thrown away after any photo failure or timeout (a lost context, a throw mid-render that
  // left GPU objects behind, a job still drawing on it): the next work gets a fresh one.
  const photoRenderer = useRef<PhotoRenderer | null>(null)
  const discardPhotoRenderer = useCallback(() => {
    photoRenderer.current?.dispose()
    photoRenderer.current = null
  }, [])
  useEffect(() => discardPhotoRenderer, [discardPhotoRenderer])

  /** A work's three photo views, rendered and encoded (both sizes each). */
  const renderPhotos = useCallback(
    async (photo: PhotoInputs) => {
      if (!photoRenderer.current) {
        const { PhotoRenderer } = await import(
          '@/components/printPresentation/photoViews/PhotoRenderer'
        )
        photoRenderer.current = new PhotoRenderer(document.createElement('canvas'))
      }
      // This work's renderer, held here: a job given up on never draws on the next one's.
      const renderer = photoRenderer.current
      try {
        return await renderPhotoViews(renderer, photo)
      } catch (err) {
        if (photoRenderer.current === renderer) discardPhotoRenderer()
        throw err
      }
    },
    [discardPhotoRenderer],
  )


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
    const timer = setTimeout(() => {
      // The job may still be drawing: its renderer goes with it.
      discardPhotoRenderer()
      finish(job.artworkId, 'failed', 'Timed out: the render never finished')
    }, JOB_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [job, finish, discardPhotoRenderer])

  const onReady = useCallback(
    async (shot: StudioShot) => {
      if (!job || busy.current || current.current !== job.artworkId) return
      busy.current = true
      try {
        const files = await encodeShot(shot.canvas, shot.window)
        const photos = job.photo ? await renderPhotos(job.photo) : null
        if (current.current !== job.artworkId) return // given up on (timed out) meanwhile
        await storeRender(
          {
            artworkId: job.artworkId,
            fingerprint: job.inputs.fingerprint,
            viewsFingerprint: job.photo?.fingerprint ?? null,
            copy: job.copy,
          },
          shot.window,
          files,
          photos,
          window.location.origin,
        )
        finish(job.artworkId, 'saved')
      } catch (err) {
        finish(job.artworkId, 'failed', err instanceof Error ? err.message : String(err))
      }
    },
    [job, finish, renderPhotos],
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
          passepartout={job.inputs.passepartout}
          seed={job.inputs.seed}
          copy={job.copy}
          widthPx={PRESENTATION_WIDTH_PX.large}
          onReady={onReady}
        />
      </StudioBoundary>
    </div>
  )
}
