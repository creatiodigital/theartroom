'use client'

import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { X } from '@phosphor-icons/react'

import {
  ObjectPageContent,
  type ObjectPageProps,
} from '@/components/artwork/object/ObjectDetailPage'
import { Button } from '@/components/ui/Button'
import { track } from '@/lib/analytics/track'
import { closeFloorObject } from '@/redux/slices/floorSlice'
import type { RootState } from '@/redux/store'

import styles from '../ArtworkModal/ArtworkModal.module.scss'

/**
 * An Object's page over the 3D room (docs/objects O5/O6: "the 3D room's artwork overlay shows
 * this same page"), opened by clicking an Object on the floor. The same window as a picture's
 * details: the × top right, Escape closes it, the room waits behind.
 */
export function FloorObjectModal() {
  const dispatch = useDispatch()
  const slug = useSelector((state: RootState) => state.floor.openObjectSlug)
  const [data, setData] = useState<ObjectPageProps | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!slug) return
    let canceled = false
    setData(null)
    setFailed(false)
    track('room_artwork_details', { item_id: slug })
    fetch(`/api/artworks/by-slug/${slug}/object`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ObjectPageProps | null) => {
        if (canceled) return
        if (d) setData(d)
        else setFailed(true)
      })
      .catch(() => !canceled && setFailed(true))
    return () => {
      canceled = true
    }
  }, [slug])

  useEffect(() => {
    if (!slug) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch(closeFloorObject())
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [slug, dispatch])

  if (!slug) return null

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Artwork detail"
      data-panel-overlay
    >
      <Button
        variant="bare"
        className={styles.close}
        onClick={() => dispatch(closeFloorObject())}
        aria-label="Close artwork"
      >
        <X size={20} weight="light" aria-hidden />
      </Button>
      <div className={styles.content}>
        <div className={styles.body}>
          {data ? (
            <ObjectPageContent {...data} />
          ) : failed ? (
            <p>This work could not be loaded.</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
