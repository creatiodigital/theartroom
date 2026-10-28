'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  listPrintPresentations,
  setPresentationFrame,
  setPrintPresentationsSwitch,
  type PresentationRow,
  type PresentationStatus,
} from '@/app/admin/print-presentations/actions'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'
import { PrintPresentation } from '@/components/printPresentation/PrintPresentation'
import { Button } from '@/components/ui/Button'
import { SelectDropdown, type SelectOption } from '@/components/ui/SelectDropdown'
import { Toggle } from '@/components/ui/Toggle'
import {
  FRAME_LABEL,
  NO_FRAME,
  PRESENTATION_FRAMES,
  type FrameChoice,
} from '@/lib/printPresentation/look'

import { supportsWebpAlpha } from './capture'
import { RenderQueue, type RenderJob } from './RenderQueue'

import styles from './PrintPresentations.module.scss'

const STATUS_LABEL: Record<PresentationStatus, string> = {
  missing: 'Missing',
  stale: 'Out of date',
  current: 'Up to date',
  ineligible: 'Not eligible',
}

const STATUS_ORDER: PresentationStatus[] = ['missing', 'stale', 'current', 'ineligible']

const FRAME_CHOICES: FrameChoice[] = [...PRESENTATION_FRAMES, NO_FRAME]
const FRAME_OPTIONS: SelectOption<FrameChoice>[] = FRAME_CHOICES.map((frame) => ({
  value: frame,
  label: FRAME_LABEL[frame],
}))

type RowOutcome = { result: 'saved' | 'failed'; error?: string }

/**
 * Every image work as a photo of its print. The admin renders what's missing or out of date —
 * in this browser (Chrome), one work at a time — and switches the presentations on for the site
 * once they look right. Each row previews its stored render, switch or no switch.
 */
export const AdminPrintPresentations = () => {
  const [rows, setRows] = useState<PresentationRow[] | null>(null)
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [canRender, setCanRender] = useState<boolean | null>(null)
  const [queue, setQueue] = useState<RenderJob[] | null>(null)
  const [stopping, setStopping] = useState(false)
  const [outcomes, setOutcomes] = useState<Record<string, RowOutcome>>({})
  const [switching, setSwitching] = useState(false)
  const [savingFrame, setSavingFrame] = useState(false)
  const [artist, setArtist] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await listPrintPresentations()
    if (!res.ok) return setError(res.error)
    setError(null)
    setRows(res.rows)
    setEnabled(res.enabled)
  }, [])

  useEffect(() => {
    void load()
    void supportsWebpAlpha().then(setCanRender)
  }, [load])

  // One option per artist (their account), with how many works they have.
  const artistOptions = useMemo(() => {
    const byArtist = new Map<string, { name: string; works: number }>()
    for (const row of rows ?? []) {
      const entry = byArtist.get(row.artistId) ?? { name: row.accountName, works: 0 }
      entry.works += 1
      byArtist.set(row.artistId, entry)
    }
    return [...byArtist]
      .sort(([, a], [, b]) => a.name.localeCompare(b.name))
      .map(([id, { name, works }]) => ({ value: id, label: `${name} (${works})` }))
  }, [rows])

  // Always one artist: the one picked, or the first in alphabetical order.
  const selected = artistOptions.some((o) => o.value === artist)
    ? (artist as string)
    : (artistOptions[0]?.value ?? null)

  const shown = useMemo(
    () => rows?.filter((row) => row.artistId === selected) ?? null,
    [rows, selected],
  )

  const counts = useMemo(() => {
    const c: Record<PresentationStatus, number> = {
      missing: 0,
      stale: 0,
      current: 0,
      ineligible: 0,
    }
    for (const row of shown ?? []) c[row.status] += 1
    return c
  }, [shown])

  // The selected artist's works only: rendering is one artist at a time, never every work at once.
  const toRender = useMemo(
    () =>
      (shown ?? []).flatMap((row) =>
        (row.status === 'missing' || row.status === 'stale') && row.inputs
          ? [{ artworkId: row.artworkId, inputs: row.inputs }]
          : [],
      ),
    [shown],
  )

  const start = (jobs: RenderJob[]) => {
    setOutcomes({})
    setStopping(false)
    setQueue(jobs)
  }

  const onRowDone = useCallback((artworkId: string, result: 'saved' | 'failed', err?: string) => {
    setOutcomes((o) => ({ ...o, [artworkId]: { result, error: err } }))
  }, [])

  const onFinished = useCallback(() => {
    setQueue(null)
    setStopping(false)
    void load()
  }, [load])

  // Saved as soon as it's picked; the row then reads as out of date until it's rendered in it.
  // Nothing can render until the list has reloaded with the new frame: a render started before
  // that would use the old one, and the server would refuse it.
  const changeFrame = async (artworkId: string, frame: FrameChoice) => {
    setSavingFrame(true)
    try {
      const res = await setPresentationFrame(artworkId, frame)
      if (!res.ok) return setError(res.error)
      await load()
    } finally {
      setSavingFrame(false)
    }
  }

  const toggleSwitch = async () => {
    if (enabled === null) return
    setSwitching(true)
    const res = await setPrintPresentationsSwitch(!enabled)
    setSwitching(false)
    if (res.ok) setEnabled(res.enabled)
    else setError(res.error)
  }

  const running = queue !== null
  const done = Object.keys(outcomes).length

  return (
    <DashboardLayout backLink="/admin/dashboard">
      <section className={dashboardStyles.section}>
        <div className={dashboardStyles.sectionHeader}>
          <h1 className={dashboardStyles.sectionTitle}>Print presentations</h1>
        </div>
        <p className={dashboardStyles.sectionDescription}>
          Every work shown as a photo of its print: in the frame picked for it (or as the bare
          sheet), a limited edition with its pencilled number. The artwork itself is never in the
          render — it sits, untouched, in the render&apos;s window. Renders run here, in this
          browser, one work at a time.
        </p>

        <div className={styles.switchRow}>
          <Toggle
            checked={enabled ?? false}
            onChange={() => void toggleSwitch()}
            disabled={enabled === null || switching}
            aria-label="Show print presentations on the site"
          />
          <span>
            {enabled
              ? 'Shown on the site: grids and artwork pages use the presentations.'
              : 'Not shown on the site yet: grids and artwork pages show the plain images.'}
          </span>
        </div>

        {selected && (
          <SelectDropdown
            label="Artist"
            className={styles.artistFilter}
            options={artistOptions}
            value={selected}
            onChange={setArtist}
          />
        )}

        <p className={styles.counts}>
          {STATUS_ORDER.map((s) => `${STATUS_LABEL[s]}: ${counts[s]}`).join(' · ')}
        </p>

        <div className={styles.actions}>
          {running ? (
            <>
              <span className={styles.progress}>
                Rendering {Math.min(done + 1, queue.length)} of {queue.length}…
              </span>
              <Button
                font="dashboard"
                variant="secondary"
                label={stopping ? 'Stopping after this work…' : 'Stop'}
                disabled={stopping}
                onClick={() => setStopping(true)}
              />
            </>
          ) : (
            <Button
              font="dashboard"
              variant="primary"
              label={`Render missing and out of date (${toRender.length})`}
              disabled={!canRender || savingFrame || toRender.length === 0}
              onClick={() => start(toRender)}
            />
          )}
        </div>
        {canRender === false && <p className={styles.error}>Rendering needs Chrome.</p>}
        {error && <p className={styles.error}>{error}</p>}
      </section>

      <section className={dashboardStyles.section}>
        {shown === null ? (
          <p className={dashboardStyles.sectionDescription}>Loading…</p>
        ) : (
          <table className={`${dashboardStyles.table} ${styles.rows}`}>
            <thead>
              <tr>
                <th>Preview</th>
                <th>Work</th>
                <th>Presentation</th>
                <th>Frame color</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => {
                const outcome = outcomes[row.artworkId]
                return (
                  <tr key={row.artworkId} data-artwork-id={row.artworkId}>
                    <td className={styles.previewCell}>
                      {row.imageUrl && (
                        <PrintPresentation
                          view={row.view}
                          size="small"
                          renderClassName={styles.previewRender}
                        >
                          {(placement) => (
                            <img
                              src={row.imageUrl!}
                              alt={row.title}
                              className={placement === 'window' ? undefined : styles.previewImage}
                            />
                          )}
                        </PrintPresentation>
                      )}
                    </td>
                    <td>
                      <div>{row.title}</div>
                      <div className={styles.muted}>{row.artistName}</div>
                    </td>
                    <td>
                      {row.inputs
                        ? row.inputs.mode === 'limited'
                          ? `Numbered, edition of ${row.inputs.edition}`
                          : 'Not numbered'
                        : '—'}
                    </td>
                    <td>
                      {row.inputs ? (
                        <SelectDropdown<FrameChoice>
                          className={styles.frameSelect}
                          options={FRAME_OPTIONS}
                          value={row.inputs.frame ?? NO_FRAME}
                          onChange={(frame) => void changeFrame(row.artworkId, frame)}
                          disabled={running || savingFrame}
                        />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <span data-status="">{STATUS_LABEL[row.status]}</span>
                      {outcome && (
                        <div className={outcome.result === 'failed' ? styles.error : styles.muted}>
                          {outcome.result === 'saved' ? 'Rendered' : outcome.error}
                        </div>
                      )}
                    </td>
                    <td>
                      {row.inputs && (
                        <Button
                          font="dashboard"
                          variant="secondary"
                          label="Re-render"
                          disabled={!canRender || running || savingFrame}
                          onClick={() => start([{ artworkId: row.artworkId, inputs: row.inputs! }])}
                        />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      {queue && (
        <RenderQueue
          jobs={queue}
          stopping={stopping}
          onRowDone={onRowDone}
          onFinished={onFinished}
        />
      )}
    </DashboardLayout>
  )
}
