'use client'

import { Check, Circle } from '@phosphor-icons/react'
import c from 'classnames'

import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { passwordChecklist } from '@/utils/password'

import styles from './PasswordFields.module.scss'

type PasswordFieldsProps = {
  ids: { password: string; confirm: string }
  password: string
  confirm: string
  onPasswordChange: (next: string) => void
  onConfirmChange: (next: string) => void
  /** Shown under New password (the caller's submit-time validation). */
  passwordError?: string
  /** Shown under Confirm password ("Passwords don’t match."). */
  confirmError?: string
}

/**
 * New password, its live checklist, Confirm password (docs/public-redesign/other-screens.md "Reset
 * password and Set your password"): the fields in the checkout style with show / hide eye buttons.
 * The checklist only turns each rule green as it is met (never red); errors come from the caller,
 * after a submit, as on every form.
 */
export const PasswordFields = ({
  ids,
  password,
  confirm,
  onPasswordChange,
  onConfirmChange,
  passwordError,
  confirmError,
}: PasswordFieldsProps) => (
  <div className={styles.fields}>
    <FormField label="New password" htmlFor={ids.password} error={passwordError}>
      <Input
        id={ids.password}
        type="password"
        size="bare"
        inputClassName={styles.input}
        value={password}
        onChange={(e) => onPasswordChange(e.target.value)}
        invalid={!!passwordError}
        autoComplete="new-password"
        showPasswordToggle
        required
      />
    </FormField>

    <ul className={styles.checklist} aria-live="polite" aria-label="Password requirements">
      {passwordChecklist(password).map((rule) => (
        <li key={rule.label} className={c(styles.rule, rule.met && styles.met)}>
          {rule.met ? (
            <Check size={14} weight="bold" aria-hidden />
          ) : (
            <Circle size={14} weight="light" aria-hidden />
          )}
          <span>
            {rule.label}
            <span className="sr-only">{rule.met ? ': done' : ': not yet'}</span>
          </span>
        </li>
      ))}
    </ul>

    <FormField label="Confirm password" htmlFor={ids.confirm} error={confirmError}>
      <Input
        id={ids.confirm}
        type="password"
        size="bare"
        inputClassName={styles.input}
        value={confirm}
        onChange={(e) => onConfirmChange(e.target.value)}
        invalid={!!confirmError}
        autoComplete="new-password"
        showPasswordToggle
        required
      />
    </FormField>
  </div>
)
