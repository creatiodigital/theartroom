'use client'

import { Check, X } from '@phosphor-icons/react'
import c from 'classnames'

import { Bar } from './Bar'

import styles from './ProgressSteps.module.scss'

export type ProgressStep = {
  label: string
  state: 'done' | 'current' | 'future'
  /** Date/time under a reached step; leave it out where nothing is stored (Q11). */
  when?: string | null
}

type ProgressStepsProps = {
  /** Spoken name of the list, e.g. "Fulfillment progress". */
  label: string
  steps: ProgressStep[]
  /** A red end marker after the steps reached, e.g. "Canceled". */
  end?: string
}

const SPOKEN_STATE: Record<ProgressStep['state'], string> = {
  done: ', done',
  current: ', current step',
  future: ', not reached yet',
}

function StepList({
  label,
  steps,
  end,
  layout,
}: ProgressStepsProps & { layout: 'track' | 'list' }) {
  return (
    <ol aria-label={label} className={layout === 'track' ? styles.track : styles.list}>
      {steps.map((step, i) => {
        const next = steps[i + 1]
        return (
          <li
            key={step.label}
            aria-current={step.state === 'current' ? 'step' : undefined}
            className={c(
              styles.step,
              styles[step.state],
              step.state !== 'future' && styles.inDark,
              next && next.state !== 'future' && styles.outDark,
              i === 0 && styles.first,
              !next && !end && styles.last,
            )}
          >
            <span aria-hidden className={styles.dot}>
              {step.state === 'done' ? <Check size={14} weight="bold" /> : i + 1}
            </span>
            <span className={styles.label}>
              {step.label}
              <span className="sr-only">{SPOKEN_STATE[step.state]}</span>
            </span>
            <span className={styles.when}>{step.state !== 'future' ? step.when : null}</span>
          </li>
        )
      })}
      {end && (
        <li className={c(styles.step, styles.end, styles.last)}>
          <span aria-hidden className={styles.dot}>
            <X size={14} weight="bold" />
          </span>
          <span className={styles.label}>{end}</span>
          <span className={styles.when} />
        </li>
      )}
    </ol>
  )
}

/**
 * A stage trail: done (dark, check), current (ringed, bold), future (gray), with
 * the date under each reached step (orders.md §2). Phones get one line,
 * "Step 2 of 7 · To place at TPS", a thin bar, and the full list in a disclosure.
 */
export function ProgressSteps({ label, steps, end }: ProgressStepsProps) {
  // The current step, or (nothing current: finished, refunded…) the last one reached.
  let position = 0
  steps.forEach((s, i) => {
    if (s.state === 'current' || (s.state === 'done' && steps[position].state !== 'current')) {
      position = i
    }
  })
  const n = position + 1

  return (
    <div className={styles.root}>
      <div className={styles.compact}>
        <p className={styles.compactLine}>
          {end ? (
            <strong className={styles.compactEnd}>{end}</strong>
          ) : (
            <>
              Step {n} of {steps.length} · <strong>{steps[position]?.label}</strong>
            </>
          )}
        </p>
        {!end && <Bar value={n} max={steps.length} size="thin" />}
        <details className={styles.disclosure}>
          <summary className={styles.summary}>All steps</summary>
          <StepList label={label} steps={steps} end={end} layout="list" />
        </details>
      </div>
      <StepList label={label} steps={steps} end={end} layout="track" />
    </div>
  )
}
