'use client'

import { useCallback, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { SettingsPanel } from '@/components/editview/SettingsPanel'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'
import { bakePageHref } from '@/lib/bake/bakePageHref'
import { isBakeRecord, type BakeRecord } from '@/lib/bake/bakeRecord'
import { editorBakeStatus } from '@/lib/bake/bakeStatus'
import { hideBakePanel } from '@/redux/slices/dashboardSlice'
import type { RootState } from '@/redux/store'

import styles from './BakePanel.module.scss'

type Loaded = { bake: BakeRecord | null; fingerprint?: string; artistSlug?: string }

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

  let message = 'Checking the bake…'
  if (failed && !loaded) message = 'Could not read the bake status.'
  else if (status === 'none') message = 'Not baked yet'
  else if (status === 'current' && bake) {
    message = `Bake is current — baked ${formatDate(bake.bakedAt)}${bake.reviewedAt ? ', reviewed' : ''}`
  } else if (status === 'stale') message = 'The room changed since the last bake.'

  const open = (mode: 'bake' | 'review') => {
    if (!url || !loaded?.artistSlug) return
    window.open(bakePageHref(loaded.artistSlug, url, mode), '_blank', 'noopener')
  }

  const ready = Boolean(loaded?.artistSlug)

  return (
    <SettingsPanel title="Baked Lighting" onClose={() => dispatch(hideBakePanel())}>
      <div className={styles.body}>
        <Text font="dashboard" as="p" size="xs" className={styles.status} data-testid="bake-status">
          {message}
        </Text>
        <Text font="dashboard" as="p" size="xs" className={styles.hint}>
          Bake lights the room once, so visitors see it instantly. Review the result before
          publishing.
        </Text>
        <div className={styles.actions}>
          <Button
            size="regular"
            variant="primary"
            label="Bake"
            fullWidth
            disabled={!ready}
            onClick={() => open('bake')}
          />
          <Button
            size="regular"
            variant="secondary"
            label="View baked room"
            fullWidth
            disabled={!ready || !bake}
            onClick={() => open('review')}
          />
        </div>
      </div>
    </SettingsPanel>
  )
}

export default BakePanel
