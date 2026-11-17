'use client'

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react'

import type { Unit } from './format'

/**
 * The visitor's unit for sizes, cm (default) or in (docs/public-redesign/units.md). Chosen only by
 * the visitor — never from IP, country, locale or browser language — and kept in this browser.
 *
 * The server and the first client render both see cm (`getServerSnapshot`), so hydration matches;
 * React then re-renders with the saved choice. The size text keeps its place: only the numbers
 * change. Storage is read and written in try/catch: when it is blocked (private windows, blocked
 * site data) the choice still holds in memory for the visit, and a fresh load starts at cm.
 */
export const UNITS_STORAGE_KEY = 'tar.units'

let current: Unit | null = null
const listeners = new Set<() => void>()

function readSaved(): Unit {
  try {
    return window.localStorage.getItem(UNITS_STORAGE_KEY) === 'in' ? 'in' : 'cm'
  } catch {
    return 'cm'
  }
}

function getSnapshot(): Unit {
  if (current === null) current = readSaved()
  return current
}

const getServerSnapshot = (): Unit => 'cm'

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function setUnit(unit: Unit) {
  current = unit
  try {
    window.localStorage.setItem(UNITS_STORAGE_KEY, unit)
  } catch {
    // Storage blocked: the choice lives in memory until the page is left.
  }
  listeners.forEach((listener) => listener())
}

type UnitsContextValue = { unit: Unit; setUnit: (unit: Unit) => void }

const UnitsContext = createContext<UnitsContextValue>({ unit: 'cm', setUnit: () => {} })

export function UnitsProvider({ children }: { children: ReactNode }) {
  const unit = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const value = useMemo(() => ({ unit, setUnit }), [unit])
  return <UnitsContext.Provider value={value}>{children}</UnitsContext.Provider>
}

/** `{ unit, setUnit }`. Outside a provider: cm, and choosing does nothing. */
export function useUnits(): UnitsContextValue {
  return useContext(UnitsContext)
}
