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
  PRESENTATION_FRAMES,
  type PresentationFrame,
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

const FRAME_OPTIONS: SelectOption<PresentationFrame>[] = PRESENTATION_FRAMES.map((frame) => ({
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

  const counts = useMemo(() => {
    const c: Record<PresentationStatus, number> = {
      missing: 0,
      stale: 0,
      current: 0,
      ineligible: 0,
    }
    for (const row of rows ?? []) c[row.status] += 1
    return c
  }, [rows])

  const toRender = useMemo(
    () =>
      (rows ?? []).flatMap((row) =>
        (row.status === 'missing' || row.status === 'stale') && row.inputs
          ? [{ artworkId: row.artworkId, inputs: row.inputs }]
          : [],
      ),
    [rows],
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
  const changeFrame = async (artworkId: string, frame: PresentationFrame) => {
    const res = await setPresentationFrame(artworkId, frame)
    if (!res.ok) return setError(res.error)
    await load()
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
          Every work shown as a photo of its print: framed for open editions and works not for sale,
          a numbered sheet for limited editions. The artwork itself is never in the render — it
          sits, untouched, in the render&apos;s window. Renders run here, in this browser, one work
          at a time.
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
              disabled={!canRender || toRender.length === 0}
              onClick={() => start(toRender)}
            />
          )}
        </div>
        {canRender === false && <p className={styles.error}>Rendering needs Chrome.</p>}
        {error && <p className={styles.error}>{error}</p>}
      </section>

      <section className={dashboardStyles.section}>
        {rows === null ? (
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
              {rows.map((row) => {
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
                          ? `Sheet, edition of ${row.inputs.edition}`
                          : 'Framed'
                        : '—'}
                    </td>
                    <td>
                      {row.inputs?.frame ? (
                        <SelectDropdown<PresentationFrame>
                          className={styles.frameSelect}
                          options={FRAME_OPTIONS}
                          value={row.inputs.frame}
                          onChange={(frame) => void changeFrame(row.artworkId, frame)}
                          disabled={running}
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
                          disabled={!canRender || running}
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
