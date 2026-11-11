'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'

import { ConfirmModal } from '@/components/ui/ConfirmModal/ConfirmModal'
import { listOrders } from '@/app/admin/orders/actions'
import { getPurchasesPausedState, togglePurchasesPaused } from '@/app/admin/settings/actions'
import { type AttentionMetric, countAttentionMetrics } from '@/lib/orders/orderBuckets'

// Shown when an action never got an answer (timeout, offline, mid-deploy) —
// distinct from the action's own `error`, which means it ran and said no.
export const UNREACHABLE = 'Could not reach the server.'

// Pages that show these numbers in full: arriving on one re-reads both, so
// the menu badge and the switch are fresh where the admin acts on them. Every
// other admin page uses what the shell read when it mounted.
const RELOAD_ON = new Set(['/admin/dashboard', '/admin/orders'])

export type StorefrontSwitchState = {
  /** null until the first read lands, and again after a failed read. */
  paused: boolean | null
  error: string | null
  toggling: boolean
  /** Opens the pause / resume confirmation. A no-op while the state is unknown. */
  requestToggle: () => void
  reload: () => Promise<void>
}

export type AttentionCountsState = {
  /** null while loading and after a failed read — never a guessed 0. */
  metrics: Record<AttentionMetric, number> | null
  error: string | null
  reload: () => Promise<void>
}

const StorefrontContext = createContext<StorefrontSwitchState | null>(null)
const CountsContext = createContext<AttentionCountsState | null>(null)

/**
 * One copy of the purchases kill switch and of the attention counts for the
 * whole admin: the side menu, the paused banner and the dashboard all read
 * these, so they can never disagree, and each is one request per visit rather
 * than one per page. Also owns the single pause / resume confirmation.
 *
 * Every action call catches TRANSPORT failures too, not just `ok: false`: a
 * 504 or a rolling deploy rejects the promise before the action's own
 * try/catch runs.
 */
export function AdminShellProvider({ children }: { children: ReactNode }) {
  const { status } = useSession()
  const pathname = usePathname() ?? ''

  // ── Purchases kill switch ──────────────────────────────────────────
  const [paused, setPaused] = useState<boolean | null>(null)
  const [pauseError, setPauseError] = useState<string | null>(null)
  const [toggling, setToggling] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  // A read that lands after a newer read (or after a toggle) must not
  // overwrite it.
  const pausedSeq = useRef(0)

  const loadPaused = useCallback(async () => {
    const seq = ++pausedSeq.current
    setPauseError(null)
    try {
      const res = await getPurchasesPausedState()
      if (seq !== pausedSeq.current) return
      if (res.ok) {
        setPaused(res.paused)
      } else {
        setPaused(null)
        setPauseError(res.error)
      }
    } catch {
      if (seq !== pausedSeq.current) return
      setPaused(null)
      setPauseError(UNREACHABLE)
    }
  }, [])

  const requestToggle = useCallback(() => {
    if (paused === null) return
    setConfirmOpen(true)
  }, [paused])

  const confirmToggle = useCallback(async () => {
    if (paused === null) return
    ++pausedSeq.current
    setToggling(true)
    setPauseError(null)
    try {
      const res = await togglePurchasesPaused(!paused)
      if (res.ok) setPaused(res.paused)
      else setPauseError(res.error)
    } catch {
      // The switch may or may not have flipped server-side — say so rather
      // than guess, and leave the shown state as it was.
      setPauseError(`${UNREACHABLE} Reload to see the current state before trying again.`)
    } finally {
      setToggling(false)
      setConfirmOpen(false)
    }
  }, [paused])

  // ── Attention counts ───────────────────────────────────────────────
  const [metrics, setMetrics] = useState<Record<AttentionMetric, number> | null>(null)
  const [countsError, setCountsError] = useState<string | null>(null)
  const countsSeq = useRef(0)

  const loadCounts = useCallback(async () => {
    const seq = ++countsSeq.current
    setCountsError(null)
    try {
      const res = await listOrders()
      if (seq !== countsSeq.current) return
      if (res.ok) {
        setMetrics(countAttentionMetrics(res.orders))
      } else {
        setMetrics(null)
        setCountsError(res.error)
      }
    } catch {
      if (seq !== countsSeq.current) return
      setMetrics(null)
      setCountsError(UNREACHABLE)
    }
  }, [])

  // First read when the shell mounts, re-read on arriving at a page that
  // shows the numbers in full. Server actions are dispatched one at a time,
  // but a page's own load runs in a CHILD effect, which React fires before
  // this one — so the page's request always goes first and never waits on the
  // shell's.
  const loaded = useRef(false)
  useEffect(() => {
    if (status !== 'authenticated') return
    if (loaded.current && !RELOAD_ON.has(pathname)) return
    loaded.current = true
    void loadPaused()
    void loadCounts()
  }, [status, pathname, loadPaused, loadCounts])

  const storefront = useMemo<StorefrontSwitchState>(
    () => ({ paused, error: pauseError, toggling, requestToggle, reload: loadPaused }),
    [paused, pauseError, toggling, requestToggle, loadPaused],
  )
  const counts = useMemo<AttentionCountsState>(
    () => ({ metrics, error: countsError, reload: loadCounts }),
    [metrics, countsError, loadCounts],
  )

  return (
    <StorefrontContext.Provider value={storefront}>
      <CountsContext.Provider value={counts}>
        {/* While the dialog is open everything else is inert, which keeps Tab
            inside it (the shared Modal does not trap focus on its own; Q5). */}
        <div inert={confirmOpen}>{children}</div>
        {confirmOpen && (
          <ConfirmModal
            title={paused ? 'Resume purchases?' : 'Pause ALL purchases?'}
            message={
              paused
                ? 'The prints catalog, Order Print buttons, cart and checkout become available to the public again immediately.'
                : 'The public site becomes read-only immediately: prints catalog, every Order Print button, cart and checkout disappear (bookmarked links included) and new payments are refused. Orders already placed are not affected. You can resume at any time.'
            }
            confirmLabel={paused ? 'Resume purchases' : 'Pause all purchases'}
            destructive={!paused}
            busy={toggling}
            onConfirm={() => void confirmToggle()}
            onCancel={() => setConfirmOpen(false)}
          />
        )}
      </CountsContext.Provider>
    </StorefrontContext.Provider>
  )
}

export function useStorefrontSwitch(): StorefrontSwitchState {
  const value = useContext(StorefrontContext)
  if (!value) throw new Error('useStorefrontSwitch must be used inside AdminShellProvider')
  return value
}

export function useAttentionCounts(): AttentionCountsState {
  const value = useContext(CountsContext)
  if (!value) throw new Error('useAttentionCounts must be used inside AdminShellProvider')
  return value
}
