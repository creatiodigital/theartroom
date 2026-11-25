'use client'

import { useState } from 'react'

import { Callout } from '@/components/admin/ui/Callout'
import { ModelChecker, type UploadedModel } from '@/components/objects/ModelChecker'
import { ModelViewer } from '@/components/objects/ModelViewer'
import { Button } from '@/components/ui/Button'
import type { BoundsCm } from '@/lib/objects/glb'

import styles from './ObjectSpaceSection.module.scss'

/** An Object's 3D model as the editor holds it (the artwork's model fields). */
export type ObjectModelState = {
  modelStatus: string
  modelUrl: string | null
  modelSizeBytes: number | null
  modelBoundsCm: BoundsCm | null
  modelReadyAt: string | null
}

const megabytes = (bytes: number | null) =>
  bytes === null ? '' : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
const longDate = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(
        new Date(iso),
      )
    : ''

/**
 * The editor's "In the 3D space" (docs/objects O4, objects-editor.dc.html): an extra. Artists send
 * their .glb files to the gallery directly (owner, 2026-11-25: no requests from the editor, no "In
 * preparation", no "Not in the 3D space yet"); the gallery team uploads the file here through the
 * checker. Then a preview to turn and the model's size (no check against Details: the artist
 * scales the Object in the 3D room, owner 2026-11-25). The editor
 * shows the section to the artist only once the model is in.
 */
export function ObjectSpaceSection({
  artworkId,
  isAdmin,
  model,
  onModelChange,
}: {
  artworkId: string
  isAdmin: boolean
  model: ObjectModelState
  onModelChange: (next: ObjectModelState) => void
}) {
  const [checking, setChecking] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const ready = model.modelStatus === 'ready' && !!model.modelUrl

  return (
    <div className={styles.space}>
      {notice && <Callout tone="info">{notice}</Callout>}

      {ready && model.modelUrl && (
        <div className={styles.ready}>
          <ModelViewer
            url={model.modelUrl}
            hint="Drag to turn"
            className={styles.viewer}
          />
          <div className={styles.facts}>
            <div className={styles.kv}>
              <span>3D model</span>
              <b>GLB · {megabytes(model.modelSizeBytes)}</b>
            </div>
            {model.modelBoundsCm && (
              <div className={styles.kv}>
                <span>Model size</span>
                <b>
                  {model.modelBoundsCm.h} × {model.modelBoundsCm.w} × {model.modelBoundsCm.d} cm
                </b>
              </div>
            )}
            <div className={styles.kv}>
              <span>Added</span>
              <b>by The Art Room · {longDate(model.modelReadyAt)}</b>
            </div>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className={styles.team}>
          <span className={styles.teamText}>
            Upload the cleaned .glb (textures inside, 1 unit = 1 m, base at 0). It is checked before
            it is sent.
          </span>
          <Button
            variant="secondary"
            font="dashboard"
            onClick={() => setChecking(true)}
            label={model.modelUrl ? 'Replace .glb' : 'Upload .glb'}
          />
        </div>
      )}

      {checking && (
        <ModelChecker
          artworkId={artworkId}
          replacing={!!model.modelUrl}
          onClose={() => setChecking(false)}
          onUploaded={(uploaded: UploadedModel) => {
            setChecking(false)
            setNotice('The 3D model is stored and ready.')
            onModelChange({ ...model, ...uploaded })
          }}
        />
      )}
    </div>
  )
}
