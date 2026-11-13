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

import { inertOutside } from './inertOutside'

type AdminDialogLayer = {
  /** Where admin dialogs portal to: inside the admin, outside the part that goes inert. */
  layer: HTMLElement | null
  /** Call while a dialog is open; returns the release. Any hold makes the admin inert. */
  hold: () => () => void
}

const DialogContext = createContext<AdminDialogLayer | null>(null)

/**
 * Keeps keyboard focus inside admin dialogs (questions.md Q5). The shared
 * Modal moves focus in but does not trap Tab, so while any admin dialog is
 * open everything else in the admin is `inert`, and the dialog itself lives
 * in a layer outside that part. When the last dialog closes, focus goes back
 * to what had it before the first one opened (the Modal's own restore runs
 * while the page is still inert, so it cannot land).
 */
export function AdminDialogProvider({ children }: { children: ReactNode }) {
  const [layer, setLayer] = useState<HTMLDivElement | null>(null)
  const [holds, setHolds] = useState(0)
  const count = useRef(0)
  const focusBefore = useRef<HTMLElement | null>(null)

  // Dialogs call this from a LAYOUT effect: that runs before the Modal's own
  // (passive) effect moves focus into the dialog, so `activeElement` is still
  // the control that opened it.
  const hold = useCallback(() => {
    if (count.current === 0) focusBefore.current = document.activeElement as HTMLElement | null
    count.current += 1
    setHolds(count.current)
    let released = false
    return () => {
      if (released) return
      released = true
      count.current = Math.max(0, count.current - 1)
      setHolds(count.current)
    }
  }, [])

  // The admin's own content goes inert through the wrapper below (at render,
  // no flash); this covers what the root layout renders around the admin.
  useEffect(() => {
    if (holds === 0 || !layer) return
    return inertOutside(layer)
  }, [holds, layer])

  // Runs after the commit that lifted `inert`, so the element can take focus.
  useEffect(() => {
    if (holds > 0 || !focusBefore.current) return
    const target = focusBefore.current
    focusBefore.current = null
    if (target.isConnected) target.focus()
  }, [holds])

  const value = useMemo(() => ({ layer, hold }), [layer, hold])

  return (
    <DialogContext.Provider value={value}>
      <div inert={holds > 0}>{children}</div>
      <div ref={setLayer} />
    </DialogContext.Provider>
  )
}

export function useAdminDialog(): AdminDialogLayer {
  const value = useContext(DialogContext)
  if (!value) throw new Error('useAdminDialog must be used inside AdminDialogProvider')
  return value
}
