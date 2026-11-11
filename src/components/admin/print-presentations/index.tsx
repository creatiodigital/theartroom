'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import c from 'classnames'

import {
  listPrintPresentations,
  setPresentationFrame,
  setPresentationPassepartout,
  setPrintPresentationsSwitch,
  type PresentationRow,
  type PresentationStatus,
} from '@/app/admin/print-presentations/actions'
import { AdminPageHeader } from '@/components/admin/ui/AdminPageHeader'
import { AdminSelect } from '@/components/admin/ui/AdminSelect'
import { Bar } from '@/components/admin/ui/Bar'
import { Callout } from '@/components/admin/ui/Callout'
import { DataTable } from '@/components/admin/ui/DataTable'
import { EmptyState } from '@/components/admin/ui/EmptyState'
import { ListPanel } from '@/components/admin/ui/ListPanel'
import { StatusPill } from '@/components/admin/ui/StatusPill'
import { PrintPresentation } from '@/components/printPresentation/PrintPresentation'
import { Button } from '@/components/ui/Button'
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

/** The status tag's tone (gallery.md §1). */
const STATUS_TONE: Record<PresentationStatus, 'redSoft' | 'amber' | 'green' | 'gray'> = {
  missing: 'redSoft',
  stale: 'amber',
  current: 'green',
  ineligible: 'gray',
}

/**
 * The list holds image works only, and an image work gets no presentation for one reason: its
 * shape is unknown (`presentationInputs`). Why a work is out of date, the page isn't told (Q60).
 */
const NOT_ELIGIBLE_REASON = 'Its shape is unknown.'

// The site switch: its input, its visible name and its line.
const SWITCH_ID = 'print-presentations-switch'
const SWITCH_NAME_ID = 'print-presentations-switch-name'
const SWITCH_LINE_ID = 'print-presentations-switch-line'

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
  const [savingSetting, setSavingSetting] = useState(false)
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

  // A frame or passepartout is saved as soon as it's picked; the row then reads as out of date
  // until it's rendered with it. Nothing can render until the list has reloaded with the new
  // setting: a render started before that would use the old one, and the server would refuse it.
  const saveSetting = async (save: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setSavingSetting(true)
    try {
      const res = await save()
      if (!res.ok) return setError(res.error)
      await load()
    } finally {
      setSavingSetting(false)
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

  // Display only: the chips read "–" until the list is in, never a count of nothing (Q62).
  const chipCount = (status: PresentationStatus) => (shown === null ? '–' : counts[status])

  return (
    <div className={styles.page}>
      <div className={styles.intro}>
        <AdminPageHeader
          eyebrow="Gallery"
          title="Print presentations"
          description="Every work shown as a photo of its print, in the frame picked for it."
        />
        <details className={styles.howItWorks}>
          <summary className={styles.summary}>How it works</summary>
          <p className={styles.explanation}>
            With or without a passepartout (or as the bare sheet), a limited edition with its
            pencilled number. The artwork itself is never in the render — it sits, untouched, in the
            render&apos;s window. Renders run here, in this browser, one work at a time. A work
            that&apos;s out of date keeps its last render on the site until it&apos;s re-rendered.
          </p>
        </details>
      </div>

      <section aria-label="Settings" className={styles.settings}>
        <div className={styles.siteSwitch}>
          <Toggle
            tone="admin"
            id={SWITCH_ID}
            checked={enabled ?? false}
            onChange={() => void toggleSwitch()}
            disabled={enabled === null || switching}
            aria-labelledby={SWITCH_NAME_ID}
            aria-describedby={SWITCH_LINE_ID}
          />
          <span className={styles.siteSwitchText}>
            <label htmlFor={SWITCH_ID} id={SWITCH_NAME_ID} className={styles.siteSwitchName}>
              Shown on the site
            </label>
            <span id={SWITCH_LINE_ID} className={styles.siteSwitchLine}>
              {enabled
                ? 'Grids and artwork pages use the presentations.'
                : 'Not shown on the site yet: grids and artwork pages show the plain images.'}
            </span>
          </span>
        </div>

        <div className={styles.controls}>
          {selected && (
            <AdminSelect label="Artist" minWidth={260} value={selected} onChange={setArtist}>
              {artistOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </AdminSelect>
          )}

          <div role="group" aria-label="Status of this artist's works" className={styles.chips}>
            {STATUS_ORDER.map((status) => {
              const tinted = shown !== null && counts[status] > 0
              return (
                <span
                  key={status}
                  className={c(
                    styles.chip,
                    tinted && status === 'missing' && styles.chipMissing,
                    tinted && status === 'stale' && styles.chipStale,
                  )}
                >
                  <strong>{chipCount(status)}</strong> {STATUS_LABEL[status]}
                </span>
              )
            })}
          </div>

          {/* Stays while rendering, as drawn; it can't start a second queue then. */}
          <Button
            variant="bare"
            font="dashboard"
            className={c(styles.button, styles.dark, styles.renderAll)}
            label={`Render missing and out of date (${toRender.length})`}
            disabled={running || !canRender || savingSetting || toRender.length === 0}
            onClick={() => start(toRender)}
          />
        </div>
        {canRender === false && <p className={styles.chrome}>Rendering needs Chrome.</p>}

        {running && (
          <div role="status" className={styles.progress}>
            <span className={styles.progressText}>
              Rendering {Math.min(done + 1, queue.length)} of {queue.length}…
            </span>
            <span className={styles.progressBar}>
              <Bar value={done} max={queue.length} size="thin" surface="gray" />
            </span>
            <Button
              variant="bare"
              font="dashboard"
              className={styles.button}
              label={stopping ? 'Stopping after this work…' : 'Stop'}
              disabled={stopping}
              onClick={() => setStopping(true)}
            />
          </div>
        )}

        {error && (
          <Callout tone="red" role="alert">
            {error}
          </Callout>
        )}
      </section>

      {/* A first load that failed has nothing to list: the red notice above says why. */}
      {(shown !== null || !error) && (
        <ListPanel label="Works">
          {shown === null ? (
            <p className={styles.loading}>Loading…</p>
          ) : shown.length === 0 ? (
            <EmptyState title="No image works yet." />
          ) : (
            <DataTable className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Work</th>
                  <th scope="col">Frame</th>
                  <th scope="col">Passepartout</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="sr-only">Render</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => {
                  const outcome = outcomes[row.artworkId]
                  const reason = outcome
                    ? outcome.result === 'saved'
                      ? 'Rendered'
                      : outcome.error
                    : row.status === 'ineligible'
                      ? NOT_ELIGIBLE_REASON
                      : undefined
                  const renderLabel = row.status === 'missing' ? 'Render' : 'Re-render'
                  const needed = row.status === 'missing' || row.status === 'stale'
                  return (
                    <tr
                      key={row.artworkId}
                      data-artwork-id={row.artworkId}
                      className={c(styles.row, !row.inputs && styles.rowIneligible)}
                    >
                      <td className={styles.cellWork}>
                        <div className={styles.work}>
                          <div className={styles.tile}>
                            {row.imageUrl ? (
                              <PrintPresentation
                                view={row.view}
                                size="small"
                                renderClassName={styles.previewRender}
                              >
                                {(placement) =>
                                  placement === 'window' ? (
                                    <img src={row.imageUrl!} alt={row.title} />
                                  ) : (
                                    <span className={styles.tileText}>No render</span>
                                  )
                                }
                              </PrintPresentation>
                            ) : (
                              <span className={styles.tileText}>No image</span>
                            )}
                          </div>
                          <div className={styles.workText}>
                            <span className={styles.title}>{row.title}</span>
                            <span className={styles.meta}>{row.artistName}</span>
                            <span className={styles.meta}>
                              {row.inputs
                                ? row.inputs.mode === 'limited'
                                  ? `Numbered, edition of ${row.inputs.edition}`
                                  : 'Not numbered'
                                : '—'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className={c(styles.cellFrame, !row.inputs && styles.none)}>
                        {row.inputs ? (
                          <AdminSelect
                            label={`Frame for ${row.title}`}
                            hideLabel
                            minWidth={160}
                            value={row.inputs.frame ?? NO_FRAME}
                            onChange={(frame) =>
                              void saveSetting(() =>
                                setPresentationFrame(row.artworkId, frame as FrameChoice),
                              )
                            }
                            disabled={running || savingSetting}
                          >
                            {FRAME_CHOICES.map((frame) => (
                              <option key={frame} value={frame}>
                                {FRAME_LABEL[frame]}
                              </option>
                            ))}
                          </AdminSelect>
                        ) : (
                          <span className={styles.dash}>—</span>
                        )}
                      </td>
                      <td className={c(styles.cellPassepartout, !row.inputs && styles.none)}>
                        {/* A passepartout needs a frame to hold it: off with "No frame". */}
                        {row.inputs ? (
                          <span className={styles.passepartout}>
                            {/* The column name, on phones (Q65); the switch's own name has it. */}
                            <span aria-hidden className={styles.phoneLabel}>
                              Passepartout
                            </span>
                            <Toggle
                              tone="admin"
                              checked={row.inputs.passepartout}
                              onChange={(e) => {
                                const on = e.target.checked
                                void saveSetting(() =>
                                  setPresentationPassepartout(row.artworkId, on),
                                )
                              }}
                              disabled={!row.inputs.frame || running || savingSetting}
                              aria-label={`Passepartout for ${row.title}`}
                            />
                          </span>
                        ) : (
                          <span className={styles.dash}>—</span>
                        )}
                      </td>
                      <td className={styles.cellStatus}>
                        <span data-status="">
                          <StatusPill
                            shape="tag"
                            tone={STATUS_TONE[row.status]}
                            label={STATUS_LABEL[row.status]}
                          />
                        </span>
                        {reason && (
                          <span
                            className={c(
                              styles.reason,
                              outcome?.result === 'failed' && styles.reasonFailed,
                            )}
                          >
                            {reason}
                          </span>
                        )}
                      </td>
                      <td className={styles.cellRender}>
                        {row.inputs && (
                          <Button
                            variant="bare"
                            font="dashboard"
                            className={c(styles.button, needed && styles.dark)}
                            label={renderLabel}
                            aria-label={`${renderLabel} ${row.title}`}
                            disabled={!canRender || running || savingSetting}
                            onClick={() =>
                              start([{ artworkId: row.artworkId, inputs: row.inputs! }])
                            }
                          />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </DataTable>
          )}
        </ListPanel>
      )}

      {queue && (
        <RenderQueue
          jobs={queue}
          stopping={stopping}
          onRowDone={onRowDone}
          onFinished={onFinished}
        />
      )}
    </div>
  )
}
