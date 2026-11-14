'use client'

import { useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { X } from '@phosphor-icons/react'

import {
  ArtworkDetailBody,
  type Artwork,
  type Artist,
  type ArtworkCommerce,
} from '@/components/artwork/detail/ArtworkDetailBody'
import { ArtworkBelowTheWork } from '@/components/artwork/detail/ArtworkBelowTheWork'
import { ArtworkTechnique } from '@/components/artwork/detail/ArtworkRichText'
import type { ArtworkMediaItem } from '@/lib/artwork/artworkMediaTypes'
import type { PublicArtistArtwork } from '@/lib/queries/getPublicArtistByHandler'
import { Button } from '@/components/ui/Button'
import type { PresentationView } from '@/lib/printPresentation/record'
import { closeArtworkModal } from '@/redux/slices/dashboardSlice'
import type { RootState } from '@/redux/store'

import { mapReduxArtwork } from './mapReduxArtwork'
import styles from './ArtworkModal.module.scss'

type FetchedDetail = {
  artwork: Partial<Artwork>
  artist: Artist
  /** Resolved server-side, exactly as the artwork page builds it, so the modal
   *  shows the same availability card rather than a reduced twin. */
  commerce: ArtworkCommerce | null
  media: ArtworkMediaItem[]
  /** Other works from the artist's page ("More by the artist"). */
  more?: PublicArtistArtwork[]
}

interface ArtworkModalProps {
  /** The work as a photo of the print, as the grids show it (AR-174); none → its plain image. */
  presentation?: PresentationView | null
}

export const ArtworkModal = ({ presentation }: ArtworkModalProps) => {
  const dispatch = useDispatch()
  const currentArtworkId = useSelector((state: RootState) => state.scene.currentArtworkId)
  const reduxArtwork = useSelector((state: RootState) =>
    currentArtworkId ? state.artworks.byId[currentArtworkId] : null,
  )
  const slug = reduxArtwork?.slug
  const [fetched, setFetched] = useState<FetchedDetail | null>(null)

  // Backfill the fields the scene doesn't hold (description, print, dims, full artist).
  useEffect(() => {
    if (!slug) return
    let canceled = false
    setFetched(null)
    fetch(`/api/artworks/by-slug/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: FetchedDetail | null) => {
        if (!canceled && data) setFetched(data)
      })
      .catch(() => {})
    return () => {
      canceled = true
    }
  }, [slug])

  // Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch(closeArtworkModal())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dispatch])

  // Lock background scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Every width (AR-172): phones and tablets enter the room now, and the
  // content below stacks as the artwork page does on a small screen.
  if (!reduxArtwork) return null

  const base = mapReduxArtwork(reduxArtwork)
  const artwork: Artwork = { ...base.artwork, ...(fetched?.artwork ?? {}) }
  const artist: Artist = fetched?.artist ?? base.artist

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Artwork detail"
      // Marks this overlay so the 3D scene's global wheel handler ignores wheel events
      // here (see MainCamera onWheel) — lets the modal content and the InquireSidebar
      // inside it scroll independently instead of the scene swallowing the scroll.
      data-panel-overlay
    >
      {/* The window's own × top right, as every window (owner, 2026-11-14), not the room
          menu button's look (other-screens.md had it so). */}
      <Button
        variant="bare"
        className={styles.close}
        onClick={() => dispatch(closeArtworkModal())}
        aria-label="Close artwork"
      >
        <X size={20} weight="light" aria-hidden />
      </Button>
      {/* Mirrors the standalone artwork page section for section: the
          two-column zone, then the story (its own full-width section), then
          the imagery. */}
      <div className={styles.content}>
        <div className={styles.body}>
          <ArtworkDetailBody
            artwork={artwork}
            artist={artist}
            commerce={fetched?.commerce}
            presentation={presentation}
            surface="room"
            technique={
              artwork.technique ? <ArtworkTechnique technique={artwork.technique} /> : null
            }
          />
        </div>

        <ArtworkBelowTheWork
          description={artwork.description}
          media={fetched?.media ?? []}
          more={fetched?.more ?? []}
          artist={artist}
        />
      </div>
    </div>
  )
}
