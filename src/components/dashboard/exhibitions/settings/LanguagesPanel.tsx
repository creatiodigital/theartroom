'use client'

import { useEffect, useMemo, useState } from 'react'

import { AdminConfirmModal } from '@/components/admin/ui/AdminConfirmModal'
import { AdminSelect } from '@/components/admin/ui/AdminSelect'
import { StatusPill } from '@/components/admin/ui/StatusPill'
import { ErrorText } from '@/components/ui/ErrorText'
import { Toggle } from '@/components/ui/Toggle'
import { SECOND_LANGUAGES, secondLanguageOf, type SecondLanguage } from '@/lib/roomLanguage'

import { StudioPanel } from '../../StudioPanel'
import page from '../../StudioPanel/studioPage.module.scss'
import styles from './LanguagesPanel.module.scss'

/** The select's value for "no second language". */
const NONE = ''

type LanguageSettings = { secondLanguage: string | null; secondLanguageVisible: boolean }

type PlacedRow = {
  artwork?: {
    artworkType?: string
    hiddenFromExhibition?: boolean
    textContentSecond?: string | null
  }
}

type LanguagesPanelProps = {
  exhibitionId: string
  initial: LanguageSettings
}

/** "14 texts have a French version · 4 show in English": a count, never a progress bar. */
const countLine = (translated: number, english: number, language: SecondLanguage) => {
  const texts = (n: number) => `${n} ${n === 1 ? 'text' : 'texts'}`
  return (
    <>
      <b className={styles.strong}>{texts(translated)}</b> {translated === 1 ? 'has' : 'have'} a{' '}
      {language.name} version · {english} {english === 1 ? 'shows' : 'show'} in English
    </>
  )
}

/**
 * Exhibition settings › Languages (AR-182, docs/wall-languages; designs/wall-languages-editor
 * §1): English always, one optional second language for the texts inside the 3D space, and the
 * visitor switch (off by default, so texts can be translated over days unseen). Everything
 * saves at once and the room reads it live: no publish needed. A text's second version doesn't
 * record a language, so changing or removing the language keeps every one.
 */
export function LanguagesPanel({ exhibitionId, initial }: LanguagesPanelProps) {
  const [settings, setSettings] = useState<LanguageSettings>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // A change away from a chosen language waits for the confirmation (the code, or NONE).
  const [confirming, setConfirming] = useState<string | null>(null)
  const [rows, setRows] = useState<PlacedRow[] | null>(null)

  const language = secondLanguageOf(settings.secondLanguage)

  // The texts on the walls (the editor's own load: every placed work, draft included).
  useEffect(() => {
    let cancelled = false
    fetch(`/api/exhibition-artworks?exhibitionId=${encodeURIComponent(exhibitionId)}&mode=edit`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: PlacedRow[] | null) => {
        if (!cancelled && Array.isArray(data)) setRows(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [exhibitionId])

  const counts = useMemo(() => {
    if (!rows || !language) return null
    const texts = rows.filter(
      (row) => row.artwork?.artworkType === 'text' && !row.artwork.hiddenFromExhibition,
    )
    const translated = texts.filter((row) => !!row.artwork?.textContentSecond?.trim()).length
    return { total: texts.length, translated, english: texts.length - translated }
  }, [rows, language])

  const save = async (next: LanguageSettings) => {
    const previous = settings
    setSettings(next)
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`/api/exhibitions/${exhibitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      if (!response.ok) throw new Error('save failed')
    } catch {
      setSettings(previous)
      setError("Couldn't save. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  // A new language starts with the visitor switch off: its texts are not translated yet.
  const choose = (code: string) => {
    void save({ secondLanguage: code === NONE ? null : code, secondLanguageVisible: false })
  }

  const onSelect = (code: string) => {
    if (code === (settings.secondLanguage ?? NONE)) return
    if (settings.secondLanguage) setConfirming(code)
    else choose(code)
  }

  const confirmingLanguage = confirming ? secondLanguageOf(confirming) : null

  return (
    <StudioPanel
      id="exhibition-languages"
      title="Languages"
      description="Only the texts inside the 3D space. The rest of the site stays in English."
    >
      <div className={styles.rows}>
        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Main language</span>
            <span className={page.help}>Every text is written in English first.</span>
          </div>
          <span className={styles.value}>English</span>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <label htmlFor="exhibition-second-language" className={styles.rowTitle}>
              Second language
            </label>
            <span id="exhibition-second-language-help" className={page.help}>
              Unlocks a second text field for every text in the 3D space.
            </span>
          </div>
          <div className={styles.select}>
            <AdminSelect
              label="Second language"
              hideLabel
              id="exhibition-second-language"
              size="form"
              value={settings.secondLanguage ?? NONE}
              onChange={onSelect}
              disabled={saving}
              aria-describedby="exhibition-second-language-help"
            >
              <option value={NONE}>None</option>
              {SECOND_LANGUAGES.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.name}
                </option>
              ))}
            </AdminSelect>
          </div>
        </div>

        {language && (
          <div className={styles.row}>
            <div className={styles.rowText}>
              <span id="exhibition-language-switch-title" className={styles.rowTitle}>
                Show the language switch to visitors
              </span>
              <span id="exhibition-language-switch-help" className={page.help}>
                {settings.secondLanguageVisible
                  ? 'Visitors can switch in the room menu and are told when they enter.'
                  : 'Off while you translate: visitors see English only.'}
              </span>
              <span className={styles.pill}>
                {settings.secondLanguageVisible ? (
                  <StatusPill label="Visible to visitors" tone="green" dot />
                ) : (
                  <StatusPill label="Hidden from visitors" tone="gray" dot />
                )}
              </span>
            </div>
            <Toggle
              tone="admin"
              checked={settings.secondLanguageVisible}
              disabled={saving}
              onChange={(event) =>
                void save({ ...settings, secondLanguageVisible: event.target.checked })
              }
              aria-labelledby="exhibition-language-switch-title"
              aria-describedby="exhibition-language-switch-help"
            />
          </div>
        )}
      </div>

      {language && (
        <div className={styles.summary}>
          <div className={styles.rowText}>
            {counts && (
              <span className={styles.count}>
                {counts.total === 0
                  ? 'There are no texts in the 3D space yet.'
                  : countLine(counts.translated, counts.english, language)}
              </span>
            )}
            <span className={page.help}>
              Translate only the texts you want; the others stay in English.
            </span>
          </div>
        </div>
      )}

      {error && <ErrorText className={page.fieldError}>{error}</ErrorText>}

      <p className={page.help}>
        Saved as soon as you change it. Changing or removing the language keeps every translation.
      </p>

      {confirming !== null && language && (
        <AdminConfirmModal
          title={
            confirmingLanguage
              ? `Change the second language to ${confirmingLanguage.name}?`
              : 'Remove the second language?'
          }
          message={
            <>
              {confirmingLanguage
                ? `Every text keeps its second version, now shown as ${confirmingLanguage.name}: check that they are in ${confirmingLanguage.name}.`
                : 'Every text keeps its second version, unseen until a second language is chosen again.'}
              {settings.secondLanguageVisible &&
                ' The language switch is hidden from visitors until you show it again.'}
            </>
          }
          confirmLabel={confirmingLanguage ? 'Change' : 'Remove'}
          icon={null}
          onConfirm={() => {
            const code = confirming
            setConfirming(null)
            choose(code)
          }}
          onCancel={() => setConfirming(null)}
        />
      )}
    </StudioPanel>
  )
}
