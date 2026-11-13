'use client'

import { useState } from 'react'
import { Check, X } from '@phosphor-icons/react'

import { PrintPresentation } from '@/components/printPresentation/PrintPresentation'
import { ProtectedImage } from '@/components/ui/ProtectedImage/ProtectedImage'

import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { useFormValidation } from '@/hooks/useFormValidation'
import type { PresentationView } from '@/lib/printPresentation/record'
import { email, minLength, name, phone, type Validator } from '@/lib/validation'

import styles from './InquireSidebar.module.scss'

type InquireSidebarProps = {
  isOpen: boolean
  onClose: () => void
  artwork: {
    slug: string
    title: string
    year?: number
    artistName: string
    imageUrl: string
    /** The photo of the print, as the artwork page shows it; without one, the plain image. */
    presentation?: PresentationView | null
  }
}

type FormErrors = {
  fullName?: string
  email?: string
  phone?: string
  message?: string
}

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error'

type FieldName = keyof FormErrors

// Built from the shared validator factories so the messages + rules live in
// one place. Module-level (stable identity) for `useFormValidation`.
const inquireValidators: Record<FieldName, Validator> = {
  // One "Full name" field, as checkout's (owner, 2026-11-13).
  fullName: name(),
  email: email(),
  phone: phone(),
  message: minLength(10, 'Please enter a message of at least 10 characters.'),
}

export const InquireSidebar = ({ isOpen, onClose, artwork }: InquireSidebarProps) => {
  const [fullName, setFullName] = useState('')
  const [emailField, setEmailField] = useState('')
  const [phoneField, setPhoneField] = useState('')
  const [message, setMessage] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle')

  // Shared house validation flow (silent → all errors on submit → clear live).
  const {
    validateAll,
    handleChange,
    fieldError,
    reset: resetValidation,
  } = useFormValidation(inquireValidators)

  const resetForm = () => {
    setFullName('')
    setEmailField('')
    setPhoneField('')
    setMessage('')
    resetValidation()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (honeypot) {
      setSubmitStatus('success')
      return
    }

    const valid = validateAll({
      fullName,
      email: emailField,
      phone: phoneField,
      message,
    })
    if (!valid) return

    setSubmitStatus('submitting')

    try {
      const response = await fetch('/api/inquire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email: emailField,
          phone: phoneField,
          message,
          artworkSlug: artwork.slug,
          artworkTitle: artwork.title,
          artworkArtist: artwork.artistName,
          // Sent so the SERVER can enforce the decoy. The early return above
          // only stops a bot driving this component; a script posting straight
          // to the API never runs it.
          website: honeypot,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send inquiry')
      }

      setSubmitStatus('success')
      resetForm()
    } catch (error) {
      console.error('Error submitting inquiry:', error)
      setSubmitStatus('error')
    }
  }

  // Closing after a result starts the next inquiry from the form again.
  const handleClose = () => {
    onClose()
    if (submitStatus === 'success' || submitStatus === 'error') setSubmitStatus('idle')
  }

  const field = (
    id: 'fullName' | 'email' | 'phone',
    label: string,
    value: string,
    set: (next: string) => void,
    maxLength: number,
    type: 'text' | 'email' = 'text',
  ) => (
    <FormField error={fieldError(id)}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => {
          set(e.target.value)
          handleChange(id, e.target.value)
        }}
        size="bare"
        inputClassName={styles.input}
        maxLength={maxLength}
        invalid={!!fieldError(id)}
      />
    </FormField>
  )

  // other-screens.md "Inquire": a right-hand panel (440 px; full screen on phones) with the work,
  // the fields in the checkout style, black Send inquiry, and the result in the same panel.
  if (!isOpen) return null

  return (
    <div className={styles.backdrop}>
      <aside
        className={styles.sidebar}
        role="dialog"
        aria-modal="true"
        aria-labelledby="inquire-title"
      >
        <div className={styles.header}>
          <h2 id="inquire-title" className={styles.title}>
            Inquire about this work
          </h2>
          <Button
            variant="bare"
            onClick={handleClose}
            className={styles.closeButton}
            aria-label="Close inquiry"
          >
            <X size={20} weight="light" aria-hidden />
          </Button>
        </div>

        <div className={styles.work}>
          {/* The rendered print, cropped to the piece and a thin border of wall as on the artwork
              page; the plain image where there is no render, or it fails to load. */}
          <div className={styles.workThumb}>
            <PrintPresentation
              view={artwork.presentation}
              size="small"
              crop
              className={styles.workPiece}
              renderClassName={styles.workRender}
            >
              {(placement) =>
                placement === 'window' ? (
                  <ProtectedImage src={artwork.imageUrl} alt={artwork.title} fill sizes="96px" />
                ) : (
                  <ProtectedImage
                    src={artwork.imageUrl}
                    alt={artwork.title}
                    width={0}
                    height={0}
                    wrapperClassName={styles.workPlain}
                    className={styles.workThumbImage}
                  />
                )
              }
            </PrintPresentation>
          </div>
          <div className={styles.workText}>
            <span className={styles.workTitle}>
              <em>{artwork.title}</em>
              {artwork.year && `, ${artwork.year}`}
            </span>
            <span className={styles.workArtist}>{artwork.artistName}</span>
          </div>
        </div>

        <div className={styles.content}>
          {submitStatus === 'success' ? (
            <div className={styles.done} role="status">
              <span className={styles.doneMark} aria-hidden>
                <Check size={20} weight="light" />
              </span>
              <p className={styles.doneTitle}>Inquiry successfully sent</p>
              <p className={styles.doneLine}>We will respond to your inquiry shortly.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className={styles.form} noValidate>
              {/* Honeypot field */}
              <input
                type="text"
                name="website"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                className={styles.honeypot}
                tabIndex={-1}
                autoComplete="off"
              />

              {field('fullName', 'Full name', fullName, setFullName, 200)}
              {field('email', 'Email', emailField, setEmailField, 200, 'email')}
              {field('phone', 'Phone', phoneField, setPhoneField, 32)}

              <FormField error={fieldError('message')}>
                <label htmlFor="message" className={styles.label}>
                  Message
                </label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value)
                    handleChange('message', e.target.value)
                  }}
                  className={styles.textarea}
                  rows={5}
                  maxLength={4000}
                  aria-invalid={!!fieldError('message') || undefined}
                />
              </FormField>

              <Button
                type="submit"
                variant="primary"
                label={submitStatus === 'submitting' ? 'Sending…' : 'Send inquiry'}
                disabled={submitStatus === 'submitting'}
                className={styles.submitButton}
              />
              {submitStatus === 'error' && (
                <p className={styles.submitError} role="alert">
                  Something went wrong. Please try again later.
                </p>
              )}

              <p className={styles.disclaimer}>
                In order to respond to your inquiry, we will process the personal data you have
                supplied in accordance with our{' '}
                <a href="/privacy-policy" className={styles.link}>
                  privacy policy
                </a>
                .
              </p>
            </form>
          )}
        </div>
      </aside>
    </div>
  )
}
