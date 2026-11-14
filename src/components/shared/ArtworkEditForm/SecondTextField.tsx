'use client'

import { useId } from 'react'

import { Callout } from '@/components/admin/ui/Callout'
import { secondTextLine, type TextRoom } from '@/lib/roomLanguage'

import styles from './ArtworkEditForm.module.scss'

export type { TextRoom }

type SecondTextFieldProps = {
  value: string
  onChange: (value: string) => void
  rooms: TextRoom[]
}

/**
 * A text artwork's second version on its own page (AR-182, docs/wall-languages; designs/
 * wall-languages-editor §3). The same field as the wall's Text tab: edited in either place, it
 * shows on every wall that uses the text. It doesn't record a language: the field is "Second
 * language", and its line names the language and the exhibition it shows in (README, answers
 * 2026-11-14). Always there, so it can be written before any exhibition offers the language.
 */
export function SecondTextField({ value, onChange, rooms }: SecondTextFieldProps) {
  const id = useId()
  const languages = new Set(rooms.map((room) => room.language).filter(Boolean))

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
        {secondTextLine(rooms)}
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
