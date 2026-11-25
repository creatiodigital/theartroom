'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { CheckCircle, UploadSimple, Warning, XCircle } from '@phosphor-icons/react'
import c from 'classnames'

import { Callout } from '@/components/admin/ui/Callout'
import { ModelViewer, type ModelViewerResult } from '@/components/objects/ModelViewer'
import { Button } from '@/components/ui/Button'
import Modal from '@/components/ui/Modal/Modal'
import {
  checkGlb,
  externalUrisOf,
  glbPasses,
  readGlbJson,
  validatorFacts,
  type GlbCheckRow,
  type GlbFacts,
  type ValidatorReport,
} from '@/lib/objects/glb'

import styles from './ModelChecker.module.scss'

/**
 * The gallery team's .glb upload with its checker (docs/objects O4, owner Q-O8: "I don't want to
 * just upload any glb and see only after it is not good"). The file is checked HERE first, before
 * anything is sent: the Khronos glTF Validator (loaded only now, when this dialog opens), then
 * the 3D room's own loaders open and draw it in the preview, then the contract's rules
 * (`checkGlb`). Upload stays off while any row fails. The server checks the stored file again
 * and refuses it on a fail.
 */
export type UploadedModel = {
  modelUrl: string
  modelSizeBytes: number
  modelBoundsCm: { h: number; w: number; d: number } | null
  modelStatus: string
  modelReadyAt: string
}

type BaseFacts = Omit<GlbFacts, 'bounds' | 'opened'>

const TITLE_ID = 'model-checker-title'

const STATUS_ICON = { pass: CheckCircle, warn: Warning, fail: XCircle } as const

function CheckRows({ rows }: { rows: GlbCheckRow[] }) {
  return (
    <ul className={styles.rows}>
      {rows.map((row) => {
        const Icon = STATUS_ICON[row.status]
        return (
          <li key={row.id} className={c(styles.row, styles[row.status])}>
            <Icon size={18} weight="fill" aria-hidden className={styles.icon} />
            <span className={styles.rowText}>
              <span className={styles.rowLabel}>
                {row.label}
                <span className="sr-only">
                  :{' '}
                  {row.status === 'pass' ? 'passed' : row.status === 'warn' ? 'warning' : 'failed'}
                </span>
              </span>
              <span className={styles.rowDetail}>{row.detail}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export default function ModelChecker({
  artworkId,
  replacing,
  onClose,
  onUploaded,
}: {
  artworkId: string
  replacing: boolean
  onClose: () => void
  onUploaded: (model: UploadedModel) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [base, setBase] = useState<BaseFacts | null>(null)
  const [viewer, setViewer] = useState<ModelViewerResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serverRows, setServerRows] = useState<GlbCheckRow[] | null>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => () => void (blobUrl && URL.revokeObjectURL(blobUrl)), [blobUrl])

  const check = async (picked: File) => {
    setError(null)
    setServerRows(null)
    setViewer(null)
    setBase(null)
    setBlobUrl(null)
    if (!picked.name.toLowerCase().endsWith('.glb')) {
      setFile(null)
      setError('Choose a .glb file.')
      return
    }
    setFile(picked)
    setChecking(true)
    const bytes = new Uint8Array(await picked.arrayBuffer())
    const json = readGlbJson(bytes)
    const facts: BaseFacts = {
      sizeBytes: bytes.byteLength,
      isGlb: json !== null,
      validator: null,
      externalUris: json ? externalUrisOf(json) : [],
      extensionsUsed: json?.extensionsUsed ?? [],
      triangles: null,
      textures: [],
    }
    try {
      // Loaded on demand: the validator never reaches any other page.
      const { validateBytes } = await import('gltf-validator')
      const report = (await validateBytes(bytes, {
        format: 'glb',
        maxIssues: 50,
      })) as ValidatorReport
      const v = validatorFacts(report)
      Object.assign(facts, {
        validator: v.validator,
        triangles: v.triangles,
        textures: v.textures,
        extensionsUsed: v.extensionsUsed.length ? v.extensionsUsed : facts.extensionsUsed,
      })
    } catch (e) {
      facts.validatorError = e instanceof Error ? e.message : 'unknown error'
    }
    setBase(facts)
    if (facts.isGlb) {
      setBlobUrl(URL.createObjectURL(new Blob([bytes], { type: 'model/gltf-binary' })))
    } else {
      setViewer({ ok: false, error: 'Not a .glb' })
    }
    setChecking(false)
  }

  // A failure sticks: a shader that fails after the first frame must not turn back into "ok".
  const onViewerResult = useCallback(
    (result: ModelViewerResult) => setViewer((prev) => (prev && !prev.ok ? prev : result)),
    [],
  )

  const rows = useMemo(() => {
    if (!base || !viewer) return null
    const textures = base.textures.map((t, i) => ({
      ...t,
      width: t.width ?? (viewer.ok ? (viewer.textureSizes[i]?.width ?? null) : null),
      height: t.height ?? (viewer.ok ? (viewer.textureSizes[i]?.height ?? null) : null),
    }))
    return checkGlb({
      ...base,
      textures,
      bounds: viewer.ok ? viewer.bounds : null,
      opened: viewer.ok
        ? { ok: true, by: 'render' }
        : { ok: false, by: 'render', error: viewer.error },
    })
  }, [base, viewer])

  const passes = rows !== null && glbPasses(rows)
  const fails = rows?.filter((r) => r.status === 'fail').length ?? 0
  const warns = rows?.filter((r) => r.status === 'warn').length ?? 0

  const upload = async () => {
    if (!file || !passes) return
    setUploading(true)
    setError(null)
    try {
      const reqRes = await fetch(`/api/artworks/${artworkId}/model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'request-upload', fileSize: file.size }),
      })
      const req = await reqRes.json()
      if (!reqRes.ok) throw new Error(req.error ?? 'Upload refused')
      const put = await fetch(req.presignedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': 'model/gltf-binary' },
      })
      if (!put.ok) throw new Error('The file could not be sent to storage')
      const doneRes = await fetch(`/api/artworks/${artworkId}/model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'complete', key: req.key }),
      })
      const done = await doneRes.json()
      if (!doneRes.ok) {
        if (Array.isArray(done.rows)) setServerRows(done.rows)
        throw new Error(done.error ?? 'Upload failed')
      }
      onUploaded(done.model)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
      setUploading(false)
    }
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    const dropped = event.dataTransfer.files?.[0]
    if (dropped && !uploading) void check(dropped)
  }

  return (
    <Modal
      tone="admin"
      layout="flush"
      titleId={TITLE_ID}
      onClose={onClose}
      maxWidth="760px"
      showClose
    >
      <div className={styles.dialog}>
        <div className={styles.head}>
          <h2 id={TITLE_ID} className={styles.title}>
            {replacing ? 'Replace the 3D model' : 'Upload the 3D model'}
          </h2>
        </div>
        {/* The report runs long: the middle scrolls, the title and Cancel · Upload stay. */}
        <div className={styles.body}>
          <p className={styles.lead}>
            The cleaned .glb: textures inside, 1 unit = 1 m, the base at 0. It is checked here
            before anything is sent, and again on the server. Nothing uploads while a check fails.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept=".glb,model/gltf-binary"
            className={styles.input}
            tabIndex={-1}
            onChange={(e) => {
              const picked = e.target.files?.[0]
              if (picked) void check(picked)
              e.target.value = ''
            }}
          />
          <div
            className={c(styles.drop, dragging && styles.dropActive)}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes('Files')) return
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <UploadSimple size={20} weight="light" aria-hidden />
            <Button
              variant="secondary"
              font="dashboard"
              disabled={uploading || checking}
              onClick={() => inputRef.current?.click()}
              label={file ? 'Choose another .glb' : 'Choose a .glb'}
            />
            <span className={styles.dropText}>{file ? file.name : 'or drop it here'}</span>
          </div>

          {(checking || blobUrl || rows) && (
            <div className={styles.result}>
              {blobUrl ? (
                <ModelViewer
                  url={blobUrl}
                  onResult={onViewerResult}
                  hint="Drag to turn · scroll to zoom"
                  className={styles.preview}
                />
              ) : (
                <div className={c(styles.preview, styles.previewEmpty)} />
              )}
              <div className={styles.report} aria-live="polite">
                {!rows ? (
                  <p className={styles.status}>Checking…</p>
                ) : (
                  <>
                    <p className={c(styles.status, passes ? styles.statusPass : styles.statusFail)}>
                      {passes
                        ? warns
                          ? `Ready to upload · ${warns} warning${warns === 1 ? '' : 's'}`
                          : 'Ready to upload'
                        : `${fails} check${fails === 1 ? '' : 's'} to fix before it can be uploaded`}
                    </p>
                    <CheckRows rows={rows} />
                  </>
                )}
              </div>
            </div>
          )}

          {serverRows && (
            <div className={styles.server}>
              <p className={c(styles.status, styles.statusFail)}>The server’s check</p>
              <CheckRows rows={serverRows} />
            </div>
          )}

          {error && (
            <Callout tone="red" role="alert">
              {error}
            </Callout>
          )}
        </div>

        <div className={styles.actions}>
          {/* The admin's own dialog buttons (ConfirmModal's): centred text, one look everywhere. */}
          <Button variant="secondary" font="dashboard" onClick={onClose} label="Cancel" />
          <Button
            variant="primary"
            font="dashboard"
            disabled={!passes || uploading}
            onClick={upload}
            label={uploading ? 'Uploading and checking…' : replacing ? 'Replace' : 'Upload'}
          />
        </div>
      </div>
    </Modal>
  )
}
