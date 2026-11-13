'use client'

import { useSyncExternalStore } from 'react'

/**
 * What a tool panel's Save area says (questions.md Q131, Q139 b; owner 2026-11-12):
 * "Unsaved changes" from any edit since the last accepted save, and a red "Not saved. Please try
 * again." after a refused save, until the next edit or an accepted save.
 *
 * Display only. Nothing here is sent, saved or read by the scene; the panels' save handlers only
 * report to it (one line each where they already set `saved`). It lives outside the panels
 * because a panel unmounts when it closes while its edits stay in the store, unsaved: reopened,
 * it still says so. One entry per exhibition and panel, for as long as that exhibition's editor
 * is open: the editor page clears them all when it unmounts or switches exhibition
 * (`resetSaveTracking`), so a client-side navigation away never carries them along.
 *
 * While any entry is unsaved, leaving the page (reload, closing the tab, Exit) asks the browser's
 * own "Leave site?", as the page editor does (Q81). In-app links are not caught.
 */
export type SaveStatus = { unsaved: boolean; failed: boolean }

type Entry = SaveStatus & {
  /** Edits counted since the page opened: a save accepted after a later edit leaves it unsaved. */
  edits: number
}

const CLEAN: Entry = { edits: 0, unsaved: false, failed: false }
const entries = new Map<string, Entry>()
const listeners = new Set<() => void>()

const askFirst = (event: BeforeUnloadEvent) => {
  event.preventDefault()
  // Older Chrome asks only when returnValue is set.
  event.returnValue = ''
}
let asking = false

const read = (key: string): Entry => entries.get(key) ?? CLEAN

const write = (key: string, entry: Entry) => {
  entries.set(key, entry)
  const anyUnsaved = [...entries.values()].some((e) => e.unsaved)
  if (anyUnsaved !== asking) {
    if (anyUnsaved) window.addEventListener('beforeunload', askFirst)
    else window.removeEventListener('beforeunload', askFirst)
    asking = anyUnsaved
  }
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Forget every entry and stop asking before unload: the editor is gone (a client-side navigation
 * away, e.g. Back or a link) or shows another exhibition, and with it the edits the entries
 * were about. Called by the editor page's cleanup (`exhibitions/edit`). Display only.
 */
export function resetSaveTracking() {
  entries.clear()
  if (asking) {
    window.removeEventListener('beforeunload', askFirst)
    asking = false
  }
  listeners.forEach((listener) => listener())
}

export type SaveTracking = {
  status: SaveStatus
  /** Beside the panel's own `setSaved(false)`: an edit. */
  edited: () => void
  /** When the save request goes out; hand the result to `finished`. */
  started: () => number
  /** `ok`: the reply the panel already checks (`response.ok`); false when the request threw. */
  finished: (sentAt: number, ok: boolean) => void
}

/**
 * The Save area's status for one panel. `key` is "{exhibition id}:{panel}", null until the
 * exhibition is known (then nothing is tracked, as the panel's save does nothing either).
 */
export function useSaveTracking(key: string | null): SaveTracking {
  const status = useSyncExternalStore(
    subscribe,
    () => (key ? read(key) : CLEAN),
    () => CLEAN,
  )

  return {
    status,
    edited: () => {
      if (!key) return
      const entry = read(key)
      write(key, { edits: entry.edits + 1, unsaved: true, failed: false })
    },
    started: () => (key ? read(key).edits : 0),
    finished: (sentAt, ok) => {
      if (!key) return
      const entry = read(key)
      write(
        key,
        ok
          ? { edits: entry.edits, unsaved: entry.edits !== sentAt, failed: false }
          : { ...entry, failed: true },
      )
    },
  }
}
