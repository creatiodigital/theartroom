'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * The grey box's strip of views (owner, 2026-11-20), for image works and Objects alike: picking a
 * view slides the box to it; on phones a swipe moves the box and the tiles follow. `count` is the
 * number of slides; with one there is no strip.
 *
 * `wanted`: the slides whose picture loads at once. The large pictures load lazily, but the one
 * picked and the one after it load at once: a picture first requested as it slides into the
 * clipped strip would show a blank slide meanwhile.
 */
export function useViewsStrip(count: number) {
  const [index, setIndex] = useState(0)
  const track = useRef<HTMLDivElement>(null)
  const [wanted, setWanted] = useState<ReadonlySet<number>>(() => new Set([0, 1]))
  const want = (...indices: number[]) =>
    setWanted((w) => (indices.every((i) => w.has(i)) ? w : new Set([...w, ...indices])))

  const show = (next: number) => {
    setIndex(next)
    want(next, next + 1)
    const strip = track.current
    if (strip) strip.scrollTo({ left: next * strip.clientWidth, behavior: 'smooth' })
  }

  const onScroll = () => {
    const strip = track.current
    if (!strip || strip.clientWidth === 0) return
    const next = Math.round(strip.scrollLeft / strip.clientWidth)
    if (next !== index && next >= 0 && next < count) {
      setIndex(next)
      want(next + 1)
    }
  }

  // A resize changes the slides' width: keep the picked one in place (only on a real width
  // change, so a swipe in progress is never moved).
  const indexRef = useRef(index)
  useEffect(() => {
    indexRef.current = index
  }, [index])
  const hasStrip = count > 1
  useEffect(() => {
    const strip = track.current
    if (!hasStrip || !strip || typeof ResizeObserver === 'undefined') return
    let width = strip.clientWidth
    const observer = new ResizeObserver(() => {
      if (strip.clientWidth === width) return
      width = strip.clientWidth
      strip.scrollLeft = indexRef.current * width
    })
    observer.observe(strip)
    return () => observer.disconnect()
  }, [hasStrip])

  return { index, track, wanted, show, onScroll }
}
