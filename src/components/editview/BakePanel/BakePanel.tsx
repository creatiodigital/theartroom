'use client'

import { useCallback, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { CheckCircle, Cube, Warning, WarningCircle, type Icon } from '@phosphor-icons/react'
import c from 'classnames'

import { InfoLine, ToolPanel } from '@/components/editorChrome'
import { Button } from '@/components/ui/Button'
import { bakePageHref } from '@/lib/bake/bakePageHref'
import { isBakeRecord, type BakeRecord } from '@/lib/bake/bakeRecord'
import { editorBakeStatus } from '@/lib/bake/bakeStatus'
import { hideBakePanel } from '@/redux/slices/dashboardSlice'
import type { RootState } from '@/redux/store'

import styles from './BakePanel.module.scss'

type Loaded = { bake: BakeRecord | null; fingerprint?: string; artistSlug?: string }

type StatusBox = { tone: 'plain' | 'red' | 'amber' | 'green'; title: string; line?: string }

const STATUS_ICON: Record<StatusBox['tone'], Icon | null> = {
  plain: null,
  red: WarningCircle,
  amber: Warning,
  green: CheckCircle,
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })

/**
 * The bake's status and the way into bake / review mode. Admin-only, baked spaces only
 * (the Menu decides); the server is what enforces who may bake or publish.
 *
 * The editor saves with plain PUTs, so the exhibition it loaded at mount goes stale after
 * every save — its `bakeFingerprint` would still match the old room. The status is therefore
 * read fresh whenever the panel opens and whenever the tab regains focus (the bake page opens
 * in another tab and changes the bake).
 */
const BakePanel = () => {
  const dispatch = useDispatch()
  const url = useSelector((state: RootState) => state.exhibition.url)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    if (!url) return
    try {
      const response = await fetch(`/api/exhibitions/by-url/${encodeURIComponent(url)}?mode=edit`, {
        cache: 'no-store',
      })
      if (!response.ok) throw new Error(String(response.status))
      const data = await response.json()
      setLoaded({
        bake: isBakeRecord(data.bake) ? data.bake : null,
        fingerprint: typeof data.bakeFingerprint === 'string' ? data.bakeFingerprint : undefined,
        artistSlug: typeof data.user?.handler === 'string' ? data.user.handler : undefined,
      })
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [url])

  useEffect(() => {
    void load()
    window.addEventListener('focus', load)
    return () => window.removeEventListener('focus', load)
  }, [load])

  const status = loaded ? editorBakeStatus(loaded.bake, loaded.fingerprint) : null
  const bake = loaded?.bake ?? null

  // Today's five states, conditions and words, in today's order; each now with its tone, and
  // the current / stale ones as a title and a line (designs/editor-3d-panels.dc.html).
  let box: StatusBox = { tone: 'plain', title: 'Checking the bake…' }
  if (failed && !loaded) box = { tone: 'red', title: 'Could not read the bake status.' }
  else if (status === 'none') box = { tone: 'amber', title: 'Not baked yet' }
  else if (status === 'current' && bake) {
    box = {
      tone: 'green',
      title: 'Bake is current',
      line: `Baked ${formatDate(bake.bakedAt)}${bake.reviewedAt ? ', reviewed' : ''}`,
    }
  } else if (status === 'stale') {
    box = { tone: 'amber', title: 'Out of date', line: 'The room changed since the last bake.' }
  }
  const BoxIcon = STATUS_ICON[box.tone]

  // AR-169 Quick bake: the bake page at `bakequality=quick` — fewer samples, shown in that tab
  // only, never uploaded or saved (`BakeRunner`).
  const open = (mode: 'bake' | 'quick' | 'review') => {
    if (!url || !loaded?.artistSlug) return
    const href = bakePageHref(loaded.artistSlug, url, mode === 'quick' ? 'bake' : mode)
    window.open(mode === 'quick' ? `${href}&bakequality=quick` : href, '_blank', 'noopener')
  }

  const ready = Boolean(loaded?.artistSlug)

  return (
    <ToolPanel
      title="Bake the room"
      description="Lights the room once, so visitors see it instantly."
      icon={Cube}
      tint="bake"
      onClose={() => dispatch(hideBakePanel())}
    >
      <div className={styles.content}>
        <div role="status" data-testid="bake-status" className={c(styles.status, styles[box.tone])}>
          {BoxIcon && (
            <BoxIcon size={18} weight="light" aria-hidden className={styles.statusIcon} />
          )}
          <span className={styles.statusText}>
            <strong className={styles.statusTitle}>{box.title}</strong>
            {box.line && <span>{box.line}</span>}
          </span>
        </div>
        <p className={styles.review}>Review the result before publishing.</p>
        <Button
          variant="bare"
          font="dashboard"
          className={styles.bake}
          disabled={!ready}
          onClick={() => open('bake')}
        >
          Bake
        </Button>
        <div className={styles.secondary}>
          <Button
            variant="bare"
            font="dashboard"
            className={styles.outline}
            disabled={!ready}
            onClick={() => open('quick')}
          >
            Quick bake
          </Button>
          <Button
            variant="bare"
            font="dashboard"
            className={styles.outline}
            disabled={!ready || !bake}
            onClick={() => open('review')}
          >
            View baked room
          </Button>
        </div>
        <InfoLine>
          Quick bake: a fast, rougher preview on this computer only. Never saved, never shown to
          visitors.
        </InfoLine>
      </div>
    </ToolPanel>
  )
}

export default BakePanel
