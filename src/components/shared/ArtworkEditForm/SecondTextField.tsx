'use client'

import { useId } from 'react'

import { Callout } from '@/components/admin/ui/Callout'
import { secondLanguageOf } from '@/lib/roomLanguage'

import styles from './ArtworkEditForm.module.scss'

type SecondTextFieldProps = {
  value: string
  onChange: (value: string) => void
  /** The exhibitions whose 3D room shows this text and offer a second language. */
  rooms: { id: string; title: string; language: string }[]
}

const joined = (parts: string[]) =>
  parts.length <= 1
    ? (parts[0] ?? '')
    : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`

/** "Shown in French in “A”" (or "in French in “A” and in Spanish in “B”"): per language. */
const whereShown = (rooms: SecondTextFieldProps['rooms']) => {
  const byLanguage = new Map<string, string[]>()
  for (const room of rooms) {
    const name = secondLanguageOf(room.language)?.name
    if (!name) continue
    byLanguage.set(name, [...(byLanguage.get(name) ?? []), `“${room.title}”`])
  }
  return joined([...byLanguage].map(([name, titles]) => `in ${name} in ${joined(titles)}`))
}

/**
 * A text artwork's second version on its own page (AR-182, docs/wall-languages; designs/
 * wall-languages-editor §3). The same field as the wall's Text tab: edited in either place, it
 * shows on every wall that uses the text. It doesn't record a language: the field is "Second
 * language", and its line names the language and the exhibition it shows in (README, answers
 * 2026-11-14). Empty: the English text shows.
 */
export function SecondTextField({ value, onChange, rooms }: SecondTextFieldProps) {
  const id = useId()
  const languages = new Set(rooms.map((room) => room.language))

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        Second language
      </label>
      <textarea
        id={id}
        className={styles.textarea}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={8}
        aria-describedby={`${id}-help`}
      />
      <p id={`${id}-help`} className={styles.help}>
        {rooms.length > 0
          ? `Shown ${whereShown(rooms)}. Leave empty to show the English text.`
          : 'Not shown at the moment: none of the exhibitions this text hangs in has a second language.'}
      </p>
      {languages.size > 1 && (
        <Callout tone="amber">
          This text hangs in exhibitions with different second languages. Visitors of each see this
          same second version.
        </Callout>
      )}
    </div>
  )
}
