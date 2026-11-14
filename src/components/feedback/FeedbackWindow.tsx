'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/Button'
import Modal from '@/components/ui/Modal/Modal'

import styles from './FeedbackWindow.module.scss'

type FeedbackWindowProps = {
  /** Where it was opened: the homepage's band or a 3D room's menu (feedback.md). */
  source: 'home' | 'room'
  /** From a room: its exhibition (the server checks it). */
  exhibitionId?: string
  onClose: () => void
}

const MIN_LENGTH = 3
const MAX_LENGTH = 2000
const FAILED = 'Something went wrong. Please try again.'

/** The window's signed opening time (the server's bot check), asked for when it opens. */
const fetchToken = async (): Promise<string | null> => {
  try {
    const res = await fetch('/api/feedback', { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { token?: unknown }
    return typeof data.token === 'string' ? data.token : null
  } catch {
    return null
  }
}

/**
 * Visitor feedback (docs/public-redesign/feedback.md; designs/feedback-band-and-window.dc.html,
 * feedback-phone.dc.html): one text box, no name or email, Send feedback, then the thank-you. The
 * homepage's band and the room menu's "Send feedback" open this same window.
 *
 * The bot checks are silent and on the server: a hidden `website` field people never fill, and a
 * token signed when the window opened. Errors only after a send (the owner's form rule): too
 * short, too many messages (the server's words), or a failure.
 */
export const FeedbackWindow = ({ source, exhibitionId, onClose }: FeedbackWindowProps) => {
  const [message, setMessage] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const token = useRef<Promise<string | null> | null>(null)

  useEffect(() => {
    token.current = fetchToken()
  }, [])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (sending) return
    if (message.trim().length < MIN_LENGTH) {
      setError('Please write a few more words.')
      return
    }
    setSending(true)
    setError('')
    try {
      // A token that failed to arrive is asked for once more.
      let signed = await token.current
      if (!signed) {
        token.current = fetchToken()
        signed = await token.current
      }
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          source,
          ...(source === 'room' && exhibitionId ? { exhibitionId } : {}),
          website: honeypot,
          token: signed,
        }),
      })
      if (res.ok) {
        setSent(true)
        return
      }
      const data = (await res.json().catch(() => null)) as { error?: unknown } | null
      setError(res.status === 429 && typeof data?.error === 'string' ? data.error : FAILED)
    } catch {
      setError(FAILED)
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal onClose={onClose} titleId="feedback-title" tone="public" maxWidth="440px" showClose>
      {sent ? (
        <div className={styles.thanks} role="status">
          <h2 id="feedback-title" className={styles.title}>
            Thank you
          </h2>
          <p className={styles.sub}>Your note goes straight to the gallery. We read every one.</p>
          {/* No Close button: the corner × alone closes every window (owner, 2026-11-14). */}
        </div>
      ) : (
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.head}>
            <h2 id="feedback-title" className={styles.title}>
              Share your thoughts
            </h2>
            <p className={styles.sub}>
              Tell us anything about the website or the 3D rooms. No names, no sign-up, just your
              thoughts.
            </p>
          </div>

          {/* Honeypot: hidden and out of the tab order; the server drops anything that fills it. */}
          <input
            type="text"
            name="website"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            className={styles.honeypot}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
          />

          <div className={styles.field}>
            <label htmlFor="feedback-message" className="sr-only">
              Your feedback
            </label>
            <textarea
              id="feedback-message"
              className={styles.textarea}
              rows={6}
              maxLength={MAX_LENGTH}
              placeholder="What did you love? What could be better?"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value)
                if (error) setError('')
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'feedback-error' : undefined}
            />
            {error && (
              <p id="feedback-error" className={styles.error} role="alert">
                {error}
              </p>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="bigSquared"
            fullWidth
            label={sending ? 'Sending…' : 'Send feedback'}
            disabled={message.trim() === '' || sending}
          />
        </form>
      )}
    </Modal>
  )
}
