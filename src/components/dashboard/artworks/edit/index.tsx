'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

import { AdminBreadcrumb } from '@/components/admin/ui/AdminBreadcrumb'
import { AdminConfirmModal } from '@/components/admin/ui/AdminConfirmModal'
import { AdminPageHeader } from '@/components/admin/ui/AdminPageHeader'
import { Callout } from '@/components/admin/ui/Callout'
import { SaveBar } from '@/components/admin/ui/SaveBar'
import { StatusPill } from '@/components/admin/ui/StatusPill'
import {
  ARTWORK_EDIT_FORM_ID,
  ArtworkEditForm,
  getInitialFormData,
  populateFormData,
} from '@/components/shared/ArtworkEditForm'
import type {
  Artwork,
  ArtworkFormData,
  ArtworkFormValue,
} from '@/components/shared/ArtworkEditForm'
import type { LimitedVariantDraft } from '@/lib/editions/types'
import type { PrintRecommendations, PrintRestrictions } from '@/lib/print-providers'
import { describeUploadFailure } from '@/lib/upload/describeUploadFailure'

import styles from './ArtworkEditPage.module.scss'

/** One of the artist's exhibitions as the Exhibitions picker needs it. */
type ExhibitionOption = {
  id: string
  mainTitle: string
  published: boolean
  sections: { id: string; title: string }[]
}

type ArtworkEditPageProps = {
  artworkId: string
}

/** The type under the title (the library's labels). */
const TYPE_LABEL: Record<string, string> = {
  image: 'Image',
  text: 'Text',
  sound: 'Sound',
  video: 'Video',
}

/**
 * Display only: the library's "Selling prints" rule (`api/artworks/route.ts`,
 * `sellingNow`), on the loaded record. Print sales on, and a live priced variant
 * (limited) or an artwork price (open); only images print.
 */
const isSellingNow = (artwork: Artwork): boolean =>
  artwork.artworkType === 'image' &&
  artwork.printEnabled === true &&
  (artwork.editionType === 'limited'
    ? (artwork.limitedVariants ?? []).some(
        (v) => v.published === true && v.blocked === true && v.priceCents != null,
      )
    : Boolean(artwork.printPriceCents))

/**
 * Display only (the save bar's "Unsaved changes"; never sent): the artwork fields
 * a Save sends, in a form that compares equal when nothing that would be saved
 * changed. The price as the cents saveArtwork computes, the exhibitions as the
 * ticked set with their sections (as saveArtwork sends them), id lists sorted.
 * Left out: the variants (the variants editor counts its own unsaved ones),
 * `editionLocked` (the server moves it: Ready to sell, Unblock, variant actions)
 * and the two rich-text fields (compared on their own, see `richTextChanged`).
 */
const savedFieldsKey = (data: ArtworkFormData): string => {
  const {
    limitedVariants: _limitedVariants,
    editionLocked: _editionLocked,
    technique: _technique,
    description: _description,
    printPriceEuros,
    exhibitionIds,
    exhibitionSections,
    printOptions,
    printRecommendations,
    ...rest
  } = data
  const parsed = Number(printPriceEuros)
  const printPriceCents =
    printPriceEuros.trim() === '' || !Number.isFinite(parsed) || parsed < 0
      ? null
      : Math.round(parsed * 100)
  const ticked = [...exhibitionIds].sort()
  return JSON.stringify({
    ...rest,
    printPriceCents,
    exhibitionIds: ticked,
    exhibitionSections: Object.fromEntries(
      ticked.map((id) => [id, exhibitionSections[id] ?? null]),
    ),
    printOptions: printOptions?.allowed
      ? Object.fromEntries(
          Object.entries(printOptions.allowed)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([dimension, ids]) => [dimension, [...ids].sort()]),
        )
      : null,
    printRecommendations: printRecommendations?.paper
      ? [...printRecommendations.paper].sort()
      : null,
  })
}

/** Display only: what a refused save sent, to tell "nothing changed since" (SaveBar `failed`). */
const comparableKey = (data: ArtworkFormData): string =>
  JSON.stringify([savedFieldsKey(data), data.technique, data.description])

export const ArtworkEditPage = ({ artworkId }: ArtworkEditPageProps) => {
  const { data: session } = useSession()
  const router = useRouter()
  const backLink = '/dashboard/artworks'

  const [artwork, setArtwork] = useState<Artwork | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // "Ready to Sell" confirmation modal + in-flight publish guard.
  // `showReadyModal` is the artwork-level publish (open editions);
  // `readyVariantIndex` is the per-variant publish (limited editions).
  const [showReadyModal, setShowReadyModal] = useState(false)
  const [readyVariantIndex, setReadyVariantIndex] = useState<number | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [formData, setFormData] = useState<ArtworkFormData>(getInitialFormData())
  // The artist's own exhibitions, for the Exhibitions checkbox section. Fetched
  // once the artwork loads (its ownerId decides whose exhibitions to list —
  // matters for an admin editing another artist's work).
  const [exhibitions, setExhibitions] = useState<ExhibitionOption[]>([])

  // Original image URL from server
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null)
  // Pending file to upload (not yet saved)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  // Local preview URL for pending file
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  // Track if user wants to remove the original image (only delete on save)
  const [pendingImageRemoval, setPendingImageRemoval] = useState(false)

  // Original image info from server
  const [imageDpi, setImageDpi] = useState<number | null>(null)
  const [originalInfo, setOriginalInfo] = useState<{
    width: number | null
    height: number | null
    originalImageUrl: string | null
    format: string | null
    sizeBytes: number | null
  }>({ width: null, height: null, originalImageUrl: null, format: null, sizeBytes: null })

  // Sound state (sound uploads are immediate, not deferred)
  const [soundUrl, setSoundUrl] = useState<string | null>(null)
  const [soundUploading, setSoundUploading] = useState(false)

  // Video state (video uploads are immediate, not deferred)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoUploading, setVideoUploading] = useState(false)

  // The save bar (artist.md §3), display only: nothing here is sent. `baseline` is
  // the form as last loaded or reloaded; `editorForm` each rich-text editor's own
  // HTML for the text it loaded with; `variantsDirty` the variants editor's unsaved
  // count; `failedSave` what a refused save sent, and whether it had a new image.
  const [baseline, setBaseline] = useState<ArtworkFormData | null>(null)
  const [editorForm, setEditorForm] = useState<{
    technique: string | null
    description: string | null
  }>({ technique: null, description: null })
  const [variantsDirty, setVariantsDirty] = useState(0)
  const [failedSave, setFailedSave] = useState<{ key: string; withFile: boolean } | null>(null)

  // Cleanup preview URL when component unmounts or file changes
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  // Fetch artwork
  useEffect(() => {
    const fetchArtwork = async () => {
      try {
        const response = await fetch(`/api/artworks/${artworkId}`)
        if (!response.ok) {
          setError('Artwork not found')
          return
        }
        const data = await response.json()

        // Verify ownership (allow admin and superAdmin to edit any artwork)
        const userType = session?.user?.userType
        const isAdminOrAbove = userType === 'admin' || userType === 'superAdmin'
        if (data.userId !== session?.user?.id && !isAdminOrAbove) {
          router.push(backLink)
          return
        }

        setArtwork(data)
        setOriginalImageUrl(data.imageUrl)
        setImageDpi(data.originalDpi ?? null)
        setOriginalInfo({
          width: data.originalWidth ?? null,
          height: data.originalHeight ?? null,
          originalImageUrl: data.originalImageUrl ?? null,
          format: data.originalFormat ?? null,
          sizeBytes: data.originalSizeBytes ?? null,
        })
        setSoundUrl(data.soundUrl || null)
        setVideoUrl(data.videoUrl || null)
        setFormData(populateFormData(data))
        setBaseline(populateFormData(data))

        // The artwork's OWN artist's exhibitions, not necessarily the viewer's
        // — an admin editing someone else's work must see that artist's shows.
        if (data.userId) {
          try {
            const exhibitionsRes = await fetch(`/api/exhibitions?userId=${data.userId}`)
            if (exhibitionsRes.ok) {
              const exhibitionsData: ExhibitionOption[] = await exhibitionsRes.json()
              setExhibitions(
                exhibitionsData.map((ex) => ({
                  id: ex.id,
                  mainTitle: ex.mainTitle,
                  published: ex.published,
                  sections: ex.sections ?? [],
                })),
              )
            }
          } catch {
            // Non-fatal: the picker just renders empty. The artwork itself
            // still loaded, so the artist can still save everything else.
          }
        }
      } catch {
        setError('Failed to load artwork')
      } finally {
        setLoading(false)
      }
    }

    if (session?.user?.id) {
      fetchArtwork()
    }
  }, [artworkId, session?.user?.id, session?.user?.userType, router, backLink])

  const handleChange = (field: string, value: ArtworkFormValue) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handlePrintOptionsChange = (next: PrintRestrictions | null) => {
    setFormData((prev) => {
      // If a paper just got vetoed, drop it from the recommendations
      // so the two stay consistent (the wizard ignores recommendations
      // outside the allowed set anyway, but better to fix at the source).
      const allowedPapers = next?.allowed?.paper
      const currentRecs = prev.printRecommendations?.paper ?? []
      const filteredRecs =
        allowedPapers && currentRecs.length > 0
          ? currentRecs.filter((id) => allowedPapers.includes(id))
          : currentRecs
      const printRecommendations =
        filteredRecs.length === currentRecs.length
          ? prev.printRecommendations
          : filteredRecs.length === 0
            ? null
            : { paper: filteredRecs }
      return { ...prev, printOptions: next, printRecommendations }
    })
  }

  const handlePrintRecommendationsChange = (next: PrintRecommendations | null) => {
    setFormData((prev) => ({ ...prev, printRecommendations: next }))
  }

  const handleEditionTypeChange = (next: 'open' | 'limited') => {
    setFormData((prev) => ({ ...prev, editionType: next }))
  }

  const handleVariantsChange = (next: LimitedVariantDraft[]) => {
    setFormData((prev) => ({ ...prev, limitedVariants: next }))
  }

  // Inline role check — don't import @/lib/authUtils here; it pulls in the
  // server-only auth + prisma chain and breaks this client component.
  const userType = session?.user?.userType
  const isAdmin = userType === 'admin' || userType === 'superAdmin'
  const isSuperAdmin = userType === 'superAdmin'

  // "Ready to Sell" — artist confirms the artwork is good to sell. Opens a
  // confirm modal; the publish (which locks the edition config and publishes
  // limited variants) only fires once they confirm.
  const handleReadyToSell = useCallback(() => {
    setShowReadyModal(true)
  }, [])

  const confirmReadyToSell = useCallback(async () => {
    setPublishing(true)
    setError('')
    try {
      const res = await fetch(`/api/artworks/${artworkId}/publish-edition`, { method: 'POST' })
      if (res.ok) {
        setFormData((prev) => ({ ...prev, editionLocked: true }))
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to mark ready to sell.')
      }
    } catch {
      setError('Failed to mark ready to sell.')
    } finally {
      setPublishing(false)
      setShowReadyModal(false)
    }
  }, [artworkId])

  // Admin-only: unblock a locked artwork so its config is editable again.
  const handleUnblock = useCallback(async () => {
    try {
      const res = await fetch(`/api/artworks/${artworkId}/unblock-edition`, { method: 'POST' })
      if (res.ok) {
        setFormData((prev) => ({ ...prev, editionLocked: false }))
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to unblock artwork.')
      }
    } catch {
      setError('Failed to unblock artwork.')
    }
  }, [artworkId])

  // Admin-only: take a live variant off sale (`blocked: false`) so its fields
  // reopen for editing. Resuming sale is the artist's "Ready to Sell" again.
  const handleUnblockVariant = useCallback(
    async (variantId: string) => {
      try {
        const res = await fetch(`/api/artworks/${artworkId}/variants/${variantId}/unblock`, {
          method: 'POST',
        })
        if (res.ok) {
          setFormData((prev) => {
            const limitedVariants = prev.limitedVariants.map((v) =>
              v.id === variantId ? { ...v, blocked: false } : v,
            )
            // Keep editionLocked in sync with the server's recompute: the
            // artwork is locked only while a variant is still live. Without
            // this the stale flag would make a later switch to Open edition
            // look "on sale + locked".
            const stillLive = limitedVariants.some(
              (v) => v.published === true && v.blocked !== false,
            )
            return { ...prev, limitedVariants, editionLocked: stillLive }
          })
        } else {
          const data = await res.json().catch(() => ({}))
          setError(data.error || 'Failed to unblock variant.')
        }
      } catch {
        setError('Failed to unblock variant.')
      }
    },
    [artworkId],
  )

  // Delete ONE saved variant, immediately. Deleting used to be a local edit
  // that only reached the database if the artist went on to save the whole
  // artwork — so a delete followed by a reload silently came back. The editor
  // owns the confirm modal and removes the row once this resolves ok; here we
  // only talk to the server and report refusals back for the modal to show.
  const handleDeleteVariant = useCallback(
    async (variantId: string): Promise<{ ok: boolean; error?: string }> => {
      setError('')
      try {
        const res = await fetch(`/api/artworks/${artworkId}/variants/${variantId}`, {
          method: 'DELETE',
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          return { ok: false, error: data.error || 'Failed to delete variant.' }
        }
        // Mirror the server's editionLocked recompute, exactly as unblocking
        // does: the series type is frozen only while a LIVE variant remains.
        // The editor drops the row straight after this resolves and
        // handleVariantsChange merges onto `prev`, so this flag survives.
        setFormData((prev) => {
          const remaining = prev.limitedVariants.filter((v) => v.id !== variantId)
          const stillLive = remaining.some((v) => v.published === true && v.blocked !== false)
          return { ...prev, editionLocked: stillLive }
        })
        return { ok: true }
      } catch {
        return { ok: false, error: 'Failed to delete variant.' }
      }
    },
    [artworkId],
  )

  // Save ONE variant on its own — create it when it has no id yet, update it
  // when it does. Deliberately independent of the artwork save, which
  // re-validates EVERY variant and so can be blocked by an unrelated row whose
  // geometry has drifted (a replaced image, say). What may actually change is
  // decided server-side: a live variant accepts only its name and price.
  const handleSaveVariant = useCallback(
    async (
      variantId: string | null,
      values: LimitedVariantDraft,
    ): Promise<{ ok: boolean; error?: string; variantId?: string }> => {
      setError('')
      const url = variantId
        ? `/api/artworks/${artworkId}/variants/${variantId}`
        : `/api/artworks/${artworkId}/variants`
      try {
        const res = await fetch(url, {
          method: variantId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) return { ok: false, error: data.error || 'Failed to save variant.' }
        return { ok: true, variantId: data.variantId }
      } catch {
        return { ok: false, error: 'Failed to save variant.' }
      }
    },
    [artworkId],
  )

  // Persist the whole form (pending image + metadata + limited variants).
  // Returns true on success. Used by both the Save button and the per-variant
  // "Ready to Sell" flow (which saves before it publishes). Does not navigate
  // or manage the busy spinner — callers own that.
  const saveArtwork = async (): Promise<boolean> => {
    setError('')

    try {
      // Step 1: If there's a pending file, upload via presigned URL
      if (pendingFile) {
        // 1a. Get presigned URL for the original
        const requestRes = await fetch('/api/upload/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'request-upload',
            artworkId,
            contentType: pendingFile.type,
            fileSize: pendingFile.size,
          }),
        })

        if (!requestRes.ok) {
          setError(await describeUploadFailure(requestRes, 'prepare'))
          return false
        }

        const { presignedUrl, originalKey } = await requestRes.json()

        // 1b. Upload original directly to R2
        const uploadRes = await fetch(presignedUrl, {
          method: 'PUT',
          body: pendingFile,
          headers: { 'Content-Type': pendingFile.type },
        })

        if (!uploadRes.ok) {
          setError(await describeUploadFailure(uploadRes, 'storage'))
          return false
        }

        // 1c. Finalize — server rebuilds the public URL from the key it
        // already issued in step 1a, then generates the web-optimized
        // version. We deliberately send the opaque key (not a URL) so
        // the complete step can never be pointed at an external host.
        const completeRes = await fetch('/api/upload/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'complete',
            artworkId,
            originalKey,
          }),
        })

        // Check `ok` BEFORE parsing. A 504 from the platform is text/plain, so
        // parsing first threw a SyntaxError that reached the bare catch below
        // and replaced every useful detail with "Something went wrong".
        if (!completeRes.ok) {
          setError(await describeUploadFailure(completeRes, 'process'))
          return false
        }

        const result = await completeRes.json()

        // Update local state with server-processed original metadata
        setOriginalImageUrl(result.imageUrl)
        setImageDpi(result.originalDpi ?? null)
        setOriginalInfo({
          width: result.originalWidth ?? null,
          height: result.originalHeight ?? null,
          originalImageUrl: result.originalImageUrl ?? null,
          format: result.originalFormat ?? null,
          sizeBytes: result.originalSizeBytes ?? null,
        })
        setPendingFile(null)
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl)
          setPreviewUrl(null)
        }
      }
      // Step 2: If image was marked for removal (and no new file), delete it
      else if (pendingImageRemoval && originalImageUrl) {
        const deleteResponse = await fetch(`/api/artworks/${artworkId}/image`, {
          method: 'DELETE',
        })
        if (!deleteResponse.ok) {
          const data = await deleteResponse.json()
          setError(data.error || 'Failed to remove image')
          return false
        }
      }

      // Step 3: Update artwork metadata. Transform the euros-string the UI
      // tracks back into the cents-integer the DB uses.
      const { printPriceEuros, ...rest } = formData
      const parsed = Number(printPriceEuros)
      const printPriceCents =
        printPriceEuros.trim() === '' || !Number.isFinite(parsed) || parsed < 0
          ? null
          : Math.round(parsed * 100)
      // An explicit section for every ticked show, so the server saves what the
      // dropdown shows. Without it, re-ticking a show this work still hangs in
      // would silently restore the section it had before it was unticked.
      const exhibitionSections = Object.fromEntries(
        rest.exhibitionIds.map((id) => [id, rest.exhibitionSections[id] ?? null]),
      )
      const payload = { ...rest, exhibitionSections, printPriceCents }

      const response = await fetch(`/api/artworks/${artworkId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to update artwork')
        return false
      }

      return true
    } catch {
      setError('Something went wrong')
      return false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const sent = { key: comparableKey(formData), withFile: pendingFile !== null }
    const ok = await saveArtwork()
    if (ok) {
      router.push(backLink)
    } else {
      setSaving(false)
      setFailedSave(sent)
    }
  }

  // Per-variant "Ready to Sell" (limited editions). Opens the confirm modal
  // for the variant at `index`; the publish only fires on confirm.
  const handleReadyToSellVariant = (index: number) => {
    setReadyVariantIndex(index)
  }

  // Save the whole form, then put the target variant on sale. We save first
  // because the variant may be a brand-new unsaved draft (no id yet) and the
  // save also validates every variant — an invalid form blocks the action.
  // A never-published draft is published (materialises its edition); a
  // previously-unblocked published variant is simply resumed (re-blocked).
  const confirmReadyToSellVariant = async () => {
    if (readyVariantIndex === null) return
    const index = readyVariantIndex
    const wasPublished = formData.limitedVariants[index]?.published === true
    setPublishing(true)
    setError('')

    const sent = { key: comparableKey(formData), withFile: pendingFile !== null }
    const saved = await saveArtwork()
    if (!saved) {
      setPublishing(false)
      setReadyVariantIndex(null)
      setFailedSave(sent)
      return
    }
    setFailedSave(null)

    try {
      // Resolve the just-saved variant's id by position: saveLimitedVariants
      // writes `order = array index`, and the GET returns variants ordered by
      // `order`, so index lines up with the editor's row.
      const res = await fetch(`/api/artworks/${artworkId}`)
      const fresh = await res.json()
      const variant = (fresh.limitedVariants ?? [])[index]
      if (!variant?.id) {
        setError('Could not find the saved variant to put on sale.')
        return
      }

      // Draft → publish (materialise edition). Unblocked published → block
      // (resume sale). Both freeze the variant + lock the series type.
      const action = wasPublished ? 'block' : 'publish'
      const put = await fetch(`/api/artworks/${artworkId}/variants/${variant.id}/${action}`, {
        method: 'POST',
      })
      const data = await put.json().catch(() => ({}))
      if (!put.ok) {
        setError(data.error || 'Failed to put variant on sale.')
        return
      }

      // Refresh so the variant shows live + the series type locks. The publish
      // route returns the fresh artwork; the block route doesn't, so refetch.
      const after =
        data.artwork ?? (await fetch(`/api/artworks/${artworkId}`).then((r) => r.json()))
      setArtwork(after)
      setFormData(populateFormData(after))
      setBaseline(populateFormData(after))
    } catch {
      setError('Failed to put variant on sale.')
    } finally {
      setPublishing(false)
      setReadyVariantIndex(null)
    }
  }

  // Store file locally and create preview (actual upload happens on save).
  // For TIFFs the uploader supplies a pre-decoded JPEG preview URL since
  // the browser can't render TIFF in <img>; we use that instead of the
  // raw blob URL so the user actually sees the artwork before saving.
  const handleImageUpload = useCallback(
    async (file: File, externalPreviewUrl?: string) => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      const newPreviewUrl = externalPreviewUrl ?? URL.createObjectURL(file)
      setPreviewUrl(newPreviewUrl)
      setPendingFile(file)
      setPendingImageRemoval(false)
    },
    [previewUrl],
  )

  // Mark image for removal (actual deletion happens on save)
  const handleRemoveImage = useCallback(() => {
    // If there's a pending file, just clear it
    if (pendingFile) {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      setPendingFile(null)
      setPreviewUrl(null)
    } else {
      // Mark original image for removal
      setPendingImageRemoval(true)
    }
  }, [pendingFile, previewUrl])

  // Determine what image URL to display
  const displayImageUrl = pendingFile ? previewUrl : pendingImageRemoval ? null : originalImageUrl

  // Sound upload (immediate - no deferred save needed)
  const handleSoundUpload = useCallback(
    async (file: File) => {
      setSoundUploading(true)
      try {
        const uploadFormData = new FormData()
        uploadFormData.append('sound', file)

        const response = await fetch(`/api/artworks/${artworkId}/sound`, {
          method: 'POST',
          body: uploadFormData,
        })

        if (!response.ok) {
          const data = await response.json()
          setError(data.error || 'Failed to upload sound')
          return
        }

        const data = await response.json()
        setSoundUrl(data.url)
      } catch {
        setError('Failed to upload sound')
      } finally {
        setSoundUploading(false)
      }
    },
    [artworkId],
  )

  const handleSoundRemove = useCallback(async () => {
    try {
      const response = await fetch(`/api/artworks/${artworkId}/sound`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to remove sound')
        return
      }

      setSoundUrl(null)
    } catch {
      setError('Failed to remove sound')
    }
  }, [artworkId])

  // Video upload (client-side direct upload to R2 via presigned URL)
  const handleVideoUpload = useCallback(
    async (file: File) => {
      setVideoUploading(true)
      try {
        // Step 1: Get presigned upload URL from the server
        const response = await fetch('/api/upload/video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'request-upload',
            artworkId,
            contentType: file.type,
            fileSize: file.size,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to get upload URL')
        }

        const { presignedUrl, publicUrl, key } = await response.json()

        // Step 2: Upload file directly to R2
        const uploadResponse = await fetch(presignedUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        })

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload video to storage')
        }

        // Step 3: Finalize — send the server-minted key (not a URL); the
        // server validates it and rebuilds the public URL itself.
        const finalizeResponse = await fetch('/api/upload/video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'complete',
            artworkId,
            key,
          }),
        })

        if (!finalizeResponse.ok) {
          const data = await finalizeResponse.json()
          throw new Error(data.error || 'Failed to finalize upload')
        }

        setVideoUrl(publicUrl)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to upload video')
      } finally {
        setVideoUploading(false)
      }
    },
    [artworkId],
  )

  const handleVideoRemove = useCallback(async () => {
    try {
      const response = await fetch(`/api/artworks/${artworkId}/video`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to remove video')
        return
      }

      setVideoUrl(null)
    } catch {
      setError('Failed to remove video')
    }
  }, [artworkId])

  const handleRichTextReady = useCallback(
    (field: 'technique' | 'description', html: string) =>
      setEditorForm((prev) => ({ ...prev, [field]: html })),
    [],
  )

  // The save bar's state (display only). A rich-text field counts as changed only
  // when it differs from both the loaded text and the editor's own form of it:
  // the editor rewrites loaded HTML on mount (an empty field becomes <p></p>).
  const richTextChanged = (field: 'technique' | 'description') =>
    baseline !== null &&
    editorForm[field] !== null &&
    formData[field] !== baseline[field] &&
    formData[field] !== editorForm[field]
  const dirty =
    baseline !== null &&
    (pendingFile !== null ||
      Boolean(pendingImageRemoval && originalImageUrl) ||
      savedFieldsKey(formData) !== savedFieldsKey(baseline) ||
      richTextChanged('technique') ||
      richTextChanged('description') ||
      variantsDirty > 0)
  const failed = failedSave !== null && failedSave.key === comparableKey(formData)
  // saveArtwork clears the pending file only once its upload has completed, so a
  // refused save that started with one and no longer has it stored the image only.
  const halfSaved = failed && failedSave.withFile && pendingFile === null

  // With unsaved changes, reloading, closing the tab or typing a URL asks the
  // browser's own "Leave site?" (as the page editor, Q81). In-app links (the
  // menu, the breadcrumb, Cancel) are not caught.
  useEffect(() => {
    if (!dirty) return
    const askFirst = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Older Chrome asks only when returnValue is set.
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', askFirst)
    return () => window.removeEventListener('beforeunload', askFirst)
  }, [dirty])

  // The saved title (it doesn't follow the Title field while typing), with the
  // library's fallback.
  const title = artwork?.title || 'Artwork'
  const artworkType = artwork?.artworkType ?? formData.artworkType
  const breadcrumb = (
    <AdminBreadcrumb items={[{ label: 'Artworks', href: backLink }, { label: title }]} />
  )

  if (loading) {
    return (
      <div className={styles.page}>
        {breadcrumb}
        <p className={styles.status}>Loading artwork…</p>
      </div>
    )
  }

  if (error && !artwork) {
    return (
      <div className={styles.page}>
        {breadcrumb}
        <Callout tone="red" role="alert">
          {error}
        </Callout>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {breadcrumb}
      <AdminPageHeader
        title={title}
        description={
          <span className={styles.meta}>
            <span>{TYPE_LABEL[artworkType] ?? artworkType}</span>
            {artwork && isSellingNow(artwork) && (
              <StatusPill tone="green" shape="tag" dot label="Selling prints" />
            )}
          </span>
        }
      />
      <ArtworkEditForm
        variant="page"
        formData={formData}
        artworkId={artworkId}
        imageUrl={displayImageUrl}
        imageDpi={imageDpi}
        originalWidth={originalInfo.width}
        originalHeight={originalInfo.height}
        originalImageUrl={originalInfo.originalImageUrl}
        originalFormat={originalInfo.format}
        originalSizeBytes={originalInfo.sizeBytes}
        soundUrl={soundUrl}
        videoUrl={videoUrl}
        exhibitions={exhibitions}
        textRooms={artwork?.textRooms}
        uploading={soundUploading || videoUploading}
        loadingText={videoUploading ? 'Uploading video…' : 'Uploading sound…'}
        saving={saving}
        error={error}
        onFormChange={handleChange}
        onPrintOptionsChange={handlePrintOptionsChange}
        onPrintRecommendationsChange={handlePrintRecommendationsChange}
        onEditionTypeChange={handleEditionTypeChange}
        onVariantsChange={handleVariantsChange}
        isAdmin={isAdmin}
        isSuperAdmin={isSuperAdmin}
        onReadyToSell={handleReadyToSell}
        onUnblock={handleUnblock}
        onUnblockVariant={handleUnblockVariant}
        onReadyToSellVariant={handleReadyToSellVariant}
        onDeleteVariant={handleDeleteVariant}
        onSaveVariant={handleSaveVariant}
        onImageUpload={handleImageUpload}
        onImageRemove={handleRemoveImage}
        onSoundUpload={handleSoundUpload}
        onSoundRemove={handleSoundRemove}
        onVideoUpload={handleVideoUpload}
        onVideoRemove={handleVideoRemove}
        onSubmit={handleSubmit}
        onCancel={() => router.push(backLink)}
        onRichTextReady={handleRichTextReady}
        onVariantsDirtyChange={setVariantsDirty}
      />
      {artwork && (
        <SaveBar
          form={ARTWORK_EDIT_FORM_ID}
          width="list"
          dirty={dirty}
          failed={failed}
          failedMessage={
            halfSaved
              ? 'Not saved: the new image was uploaded, the details were not. Please try again.'
              : undefined
          }
          saving={saving}
          onCancel={() => router.push(backLink)}
        />
      )}
      {showReadyModal && (
        <AdminConfirmModal
          title="Mark this artwork as ready to sell?"
          message="Once confirmed, the edition type and variants are locked and the artwork goes on sale. You can’t change the edition type unless an admin unblocks it. Save any pending changes first."
          confirmLabel="Yes, start selling"
          busyLabel="Working…"
          busy={publishing}
          onConfirm={confirmReadyToSell}
          onCancel={() => setShowReadyModal(false)}
        />
      )}
      {readyVariantIndex !== null && (
        <AdminConfirmModal
          title="Put this variant on sale?"
          message={`This saves your changes and puts ${
            formData.limitedVariants[readyVariantIndex]?.name?.trim() || 'this variant'
          } on sale as a numbered edition. Its size and edition count are then frozen — only an admin can take it off sale to edit it again.`}
          confirmLabel="Yes, put on sale"
          busyLabel="Working…"
          busy={publishing}
          onConfirm={confirmReadyToSellVariant}
          onCancel={() => setReadyVariantIndex(null)}
        />
      )}
    </div>
  )
}
