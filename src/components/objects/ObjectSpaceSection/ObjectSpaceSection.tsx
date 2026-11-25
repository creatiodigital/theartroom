'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { DownloadSimple, Paperclip, X } from '@phosphor-icons/react'
import c from 'classnames'

import { Callout } from '@/components/admin/ui/Callout'
import { ModelChecker, type UploadedModel } from '@/components/objects/ModelChecker'
import { ModelViewer } from '@/components/objects/ModelViewer'
import { Button } from '@/components/ui/Button'
import Modal from '@/components/ui/Modal/Modal'
import { sizeCheck, type BoundsCm, type DetailsSize } from '@/lib/objects/glb'

import styles from './ObjectSpaceSection.module.scss'

/** An Object's 3D model as the editor holds it (the artwork's model fields). */
export type ObjectModelState = {
  modelStatus: string
  modelUrl: string | null
  modelSizeBytes: number | null
  modelBoundsCm: BoundsCm | null
  modelRequestedAt: string | null
  modelReadyAt: string | null
}

type RequestFile = {
  key: string
  url: string
  name: string
  sentAt: string | null
  sizeBytes: number | null
}

const REQUEST_ACCEPT = '.glb,.obj,.fbx,.stl'
const REQUEST_MAX_BYTES = 200 * 1024 * 1024
const REQUEST_TITLE_ID = 'model-request-title'

const megabytes = (bytes: number | null) =>
  bytes === null ? '' : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
const shortDate = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(iso))
    : ''
const longDate = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(
        new Date(iso),
      )
    : ''

/** "Ask for a 3D model" (none) or "Ask for a change" (ready): a note, and for a model a file. */
function RequestDialog({
  artworkId,
  kind,
  onClose,
  onSent,
}: {
  artworkId: string
  kind: 'model' | 'change'
  onClose: () => void
  onSent: (next: { modelStatus: string; modelRequestedAt: string }) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    if (kind === 'change' && !note.trim()) {
      setError('Please say what should change.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      let fileKey: string | null = null
      if (file) {
        const reqRes = await fetch(`/api/artworks/${artworkId}/model-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'request-upload',
            fileName: file.name,
            fileSize: file.size,
          }),
        })
        const req = await reqRes.json()
        if (!reqRes.ok) throw new Error(req.error ?? 'The file was refused')
        const put = await fetch(req.presignedUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': 'application/octet-stream' },
        })
        if (!put.ok) throw new Error('The file could not be sent')
        fileKey = req.key
      }
      const res = await fetch(`/api/artworks/${artworkId}/model-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'send', kind, note, fileKey }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'The request could not be sent')
      onSent(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The request could not be sent')
      setBusy(false)
    }
  }

  const pick = (picked: File | undefined) => {
    if (!picked) return
    const ext = picked.name.split('.').pop()?.toLowerCase() ?? ''
    if (!['glb', 'obj', 'fbx', 'stl'].includes(ext)) {
      setError('Send a GLB, OBJ, FBX or STL file.')
      return
    }
    if (picked.size > REQUEST_MAX_BYTES) {
      setError('The file is too large: at most 200 MB.')
      return
    }
    setError(null)
    setFile(picked)
  }

  return (
    <Modal tone="admin" titleId={REQUEST_TITLE_ID} onClose={onClose} showClose>
      <div className={styles.dialog}>
        <h2 id={REQUEST_TITLE_ID} className={styles.dialogTitle}>
          {kind === 'model' ? 'Ask for a 3D model' : 'Ask for a change'}
        </h2>
        <p className={styles.dialogLead}>
          {kind === 'model'
            ? 'We prepare the 3D model for you. Send us a 3D scan or model if you have one (GLB, OBJ, FBX, STL), or we work from your photos.'
            : 'Tell us what should change. We will email you when the new version is ready.'}
        </p>
        <div className={styles.field}>
          <label htmlFor="model-request-note" className={styles.label}>
            {kind === 'model' ? 'Note (optional)' : 'What should change'}
          </label>
          <textarea
            id="model-request-note"
            className={styles.textarea}
            rows={4}
            maxLength={2000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {kind === 'model' && (
          <div className={styles.field}>
            <span className={styles.label}>Scan or model (optional)</span>
            <input
              ref={inputRef}
              type="file"
              accept={REQUEST_ACCEPT}
              className={styles.hiddenInput}
              tabIndex={-1}
              onChange={(e) => {
                pick(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            {file ? (
              <span className={styles.attached}>
                <Paperclip size={16} weight="light" aria-hidden />
                {file.name} · {megabytes(file.size)}
                <Button
                  variant="bare"
                  font="dashboard"
                  className={styles.iconButton}
                  aria-label={`Remove ${file.name}`}
                  onClick={() => setFile(null)}
                >
                  <X size={14} weight="light" aria-hidden />
                </Button>
              </span>
            ) : (
              <Button
                variant="bare"
                font="dashboard"
                className={styles.outline}
                onClick={() => inputRef.current?.click()}
              >
                <Paperclip size={16} weight="light" aria-hidden />
                Attach a file
              </Button>
            )}
            <span className={styles.help}>GLB, OBJ, FBX or STL, up to 200 MB.</span>
          </div>
        )}
        {error && (
          <Callout tone="red" role="alert">
            {error}
          </Callout>
        )}
        <div className={styles.dialogActions}>
          <Button variant="bare" font="dashboard" className={styles.outline} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="bare"
            font="dashboard"
            className={styles.dark}
            disabled={busy}
            onClick={send}
          >
            {busy ? 'Sending…' : 'Send request'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/**
 * The editor's "In the 3D space" (docs/objects O4, objects-editor.dc.html): an extra. The artist
 * asks for a model (Not yet → In preparation); the gallery team uploads the .glb through the
 * checker (Ready); then a preview to turn, the real size, the size check against Details and
 * "Ask for a change". The team also sees the files artists sent.
 */
export function ObjectSpaceSection({
  artworkId,
  isAdmin,
  model,
  details,
  onModelChange,
}: {
  artworkId: string
  isAdmin: boolean
  model: ObjectModelState
  details: DetailsSize
  onModelChange: (next: ObjectModelState) => void
}) {
  const [asking, setAsking] = useState<'model' | 'change' | null>(null)
  const [checking, setChecking] = useState(false)
  const [files, setFiles] = useState<RequestFile[]>([])
  const [notice, setNotice] = useState<string | null>(null)

  const loadFiles = useCallback(async () => {
    if (!isAdmin) return
    const res = await fetch(`/api/artworks/${artworkId}/model-request`)
    if (res.ok) setFiles((await res.json()).files)
  }, [artworkId, isAdmin])

  useEffect(() => {
    void loadFiles()
  }, [loadFiles])

  const ready = model.modelStatus === 'ready'
  const requested = model.modelStatus === 'requested'
  const check = sizeCheck(model.modelBoundsCm, details)

  return (
    <div className={styles.space}>
      {notice && <Callout tone="info">{notice}</Callout>}

      {model.modelStatus === 'none' && (
        <div className={styles.notYet}>
          <span className={styles.notYetText}>
            <strong>Not in the 3D space yet</strong>
            <span>
              We prepare the 3D model for you. Send us a 3D scan or model if you have one (GLB, OBJ,
              FBX, STL), or we work from your photos.
            </span>
          </span>
          <Button
            variant="bare"
            font="dashboard"
            className={styles.dark}
            onClick={() => setAsking('model')}
          >
            Ask for a 3D model
          </Button>
        </div>
      )}

      {requested && (
        <div className={styles.preparing}>
          <span aria-hidden className={styles.preparingDot} />
          <strong>In preparation</strong>
          <span>
            Asked {shortDate(model.modelRequestedAt)} · we will email you when it is ready.
          </span>
        </div>
      )}

      {model.modelUrl && (
        <div className={styles.ready}>
          <ModelViewer
            url={model.modelUrl}
            hint="Drag to turn · scroll to zoom"
            className={styles.viewer}
          />
          <div className={styles.facts}>
            <div className={styles.kv}>
              <span>3D model</span>
              <b>GLB · {megabytes(model.modelSizeBytes)}</b>
            </div>
            {model.modelBoundsCm && (
              <div className={styles.kv}>
                <span>Real size</span>
                <b>
                  {model.modelBoundsCm.h} × {model.modelBoundsCm.w} × {model.modelBoundsCm.d} cm
                </b>
              </div>
            )}
            <div className={styles.kv}>
              <span>Size check</span>
              <b
                className={c(
                  check.status === 'match' && styles.match,
                  check.status === 'differ' && styles.differ,
                )}
              >
                {check.text}
              </b>
            </div>
            <div className={styles.kv}>
              <span>Prepared</span>
              <b>by The Art Room · {longDate(model.modelReadyAt)}</b>
            </div>
            {ready && (
              <div className={styles.factsActions}>
                <Button
                  variant="bare"
                  font="dashboard"
                  className={styles.outline}
                  onClick={() => setAsking('change')}
                >
                  Ask for a change
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {isAdmin && (
        <div className={styles.team}>
          <span className={styles.teamEyebrow}>Gallery team only</span>
          <span className={styles.teamText}>
            Upload the cleaned .glb (textures inside, 1 unit = 1 m, base at 0). It is checked before
            it is sent; we check the size against the one in Details.
          </span>
          <Button
            variant="bare"
            font="dashboard"
            className={styles.outline}
            onClick={() => setChecking(true)}
          >
            {model.modelUrl ? 'Replace .glb' : 'Upload .glb'}
          </Button>
          {files.length > 0 && (
            <ul className={styles.files}>
              {files.map((f) => (
                <li key={f.key}>
                  <a href={f.url} download className={styles.fileLink}>
                    <DownloadSimple size={14} weight="light" aria-hidden />
                    {f.name}
                  </a>
                  <span>
                    {megabytes(f.sizeBytes)}
                    {f.sentAt ? ` · sent ${shortDate(f.sentAt)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {asking && (
        <RequestDialog
          artworkId={artworkId}
          kind={asking}
          onClose={() => setAsking(null)}
          onSent={(next) => {
            // The In preparation box says it ("we will email you when it is ready").
            setAsking(null)
            setNotice(null)
            onModelChange({ ...model, ...next })
            void loadFiles()
          }}
        />
      )}

      {checking && (
        <ModelChecker
          artworkId={artworkId}
          details={details}
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
