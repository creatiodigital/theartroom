'use client'

import { useState } from 'react'
import Image from 'next/image'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Text } from '@/components/ui/Typography'
import { Modal } from '@/components/ui/Modal'

import styles from './InquireSidebar.module.scss'

type InquireSidebarProps = {
  isOpen: boolean
  onClose: () => void
  artwork: {
    id: string
    title: string
    year?: number
    artistName: string
    imageUrl: string
  }
}

type FormErrors = {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  message?: string
}

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error'

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Phone validation regex - allows various formats
const phoneRegex = /^[\d\s\-+().]{7,20}$/

export const InquireSidebar = ({ isOpen, onClose, artwork }: InquireSidebarProps) => {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle')
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [showModal, setShowModal] = useState(false)

  const validateField = (field: string, value: string): string | undefined => {
    switch (field) {
      case 'firstName':
        if (!value.trim()) return 'First name is required'
        if (value.trim().length < 2) return 'First name is too short'
        break
      case 'lastName':
        if (!value.trim()) return 'Last name is required'
        if (value.trim().length < 2) return 'Last name is too short'
        break
      case 'email':
        if (!value.trim()) return 'Email is required'
        if (!emailRegex.test(value)) return 'Please enter a valid email address'
        break
      case 'phone':
        if (!value.trim()) return 'Phone number is required'
        if (!phoneRegex.test(value)) return 'Please enter a valid phone number'
        break
      case 'message':
        if (!value.trim()) return 'Message is required'
        if (value.trim().length < 10) return 'Message is too short (minimum 10 characters)'
        break
    }
    return undefined
  }

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {
      firstName: validateField('firstName', firstName),
      lastName: validateField('lastName', lastName),
      email: validateField('email', email),
      phone: validateField('phone', phone),
      message: validateField('message', message),
    }

    setErrors(newErrors)
    return !Object.values(newErrors).some((error) => error !== undefined)
  }

  const handleBlur = (field: string, value: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
    const error = validateField(field, value)
    setErrors((prev) => ({ ...prev, [field]: error }))
  }

  const resetForm = () => {
    setFirstName('')
    setLastName('')
    setEmail('')
    setPhone('')
    setMessage('')
    setTouched({})
    setErrors({})
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Honeypot check - if filled, it's a bot
    if (honeypot) {
      console.log('Bot detected via honeypot')
      setSubmitStatus('success')
      setShowModal(true)
      onClose()
      return
    }

    if (!validateForm()) {
      setTouched({
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        message: true,
      })
      return
    }

    setSubmitStatus('submitting')

    try {
      const response = await fetch('/api/inquire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
          message,
          artworkId: artwork.id,
          artworkTitle: artwork.title,
          artworkArtist: artwork.artistName,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send inquiry')
      }

      setSubmitStatus('success')
      resetForm()
      onClose()
      setShowModal(true)
    } catch (error) {
      console.error('Error submitting inquiry:', error)
      setSubmitStatus('error')
      onClose()
      setShowModal(true)
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setSubmitStatus('idle')
  }

  return (
    <>
      {/* Success/Error Modal */}
      {showModal && (
        <Modal onClose={closeModal}>
          <div className={styles.modalContent}>
            {submitStatus === 'success' ? (
              <>
                <Text as="p" size="sm">
                  → Inquiry successfully sent
                </Text>
                <Text as="p" size="xs" className={styles.modalSubtext}>
                  We will respond to your inquiry shortly.
                </Text>
              </>
            ) : (
              <>
                <Text as="p" size="sm">
                  → Something went wrong
                </Text>
                <Text as="p" size="xs" className={styles.modalSubtext}>
                  Please try again later.
                </Text>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* Sidebar */}
      {isOpen && (
        <div className={`${styles.backdrop} ${styles.open}`}>
          <div className={`${styles.sidebar} ${styles.open}`}>
            <div className={styles.header}>
              <Text as="h2" size="2xl" font="serif" className={styles.title}>
                Send an inquiry
              </Text>
              <button onClick={onClose} className={styles.closeButton}>
                CLOSE <span className={styles.closeIcon}>×</span>
              </button>
            </div>

            <div className={styles.content}>
              <form onSubmit={handleSubmit} className={styles.form}>
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

                <div className={styles.field}>
                  <label htmlFor="firstName" className={styles.label}>
                    First name
                  </label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    onBlur={() => handleBlur('firstName', firstName)}
                    variant="underline"
                    className={`${styles.input} ${touched.firstName && errors.firstName ? styles.inputError : ''}`}
                  />
                  {touched.firstName && errors.firstName && (
                    <Text as="span" size="xs" className={styles.errorText}>
                      {errors.firstName}
                    </Text>
                  )}
                </div>

                <div className={styles.field}>
                  <label htmlFor="lastName" className={styles.label}>
                    Last name
                  </label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    onBlur={() => handleBlur('lastName', lastName)}
                    variant="underline"
                    className={`${styles.input} ${touched.lastName && errors.lastName ? styles.inputError : ''}`}
                  />
                  {touched.lastName && errors.lastName && (
                    <Text as="span" size="xs" className={styles.errorText}>
                      {errors.lastName}
                    </Text>
                  )}
                </div>

                <div className={styles.field}>
                  <label htmlFor="email" className={styles.label}>
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => handleBlur('email', email)}
                    variant="underline"
                    className={`${styles.input} ${touched.email && errors.email ? styles.inputError : ''}`}
                  />
                  {touched.email && errors.email && (
                    <Text as="span" size="xs" className={styles.errorText}>
                      {errors.email}
                    </Text>
                  )}
                </div>

                <div className={styles.field}>
                  <label htmlFor="phone" className={styles.label}>
                    Phone
                  </label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onBlur={() => handleBlur('phone', phone)}
                    variant="underline"
                    className={`${styles.input} ${touched.phone && errors.phone ? styles.inputError : ''}`}
                  />
                  {touched.phone && errors.phone && (
                    <Text as="span" size="xs" className={styles.errorText}>
                      {errors.phone}
                    </Text>
                  )}
                </div>

                <div className={styles.field}>
                  <label htmlFor="message" className={styles.label}>
                    Message
                  </label>
                  <textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onBlur={() => handleBlur('message', message)}
                    className={`${styles.textarea} ${touched.message && errors.message ? styles.textareaError : ''}`}
                    rows={4}
                  />
                  {touched.message && errors.message && (
                    <Text as="span" size="xs" className={styles.errorText}>
                      {errors.message}
                    </Text>
                  )}
                </div>

                <div className={styles.artworkPreview}>
                  <div className={styles.artworkImage}>
                    <Image
                      src={artwork.imageUrl}
                      alt={artwork.title}
                      width={80}
                      height={80}
                      style={{ objectFit: 'cover' }}
                    />
                  </div>
                  <div className={styles.artworkInfo}>
                    <Text as="p" size="sm" weight="medium">
                      {artwork.artistName}
                    </Text>
                    <Text as="p" size="sm" font="serif">
                      <em>{artwork.title}</em>
                      {artwork.year && `, ${artwork.year}`}
                    </Text>
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="bigSquared"
                  label={submitStatus === 'submitting' ? 'Sending...' : 'Send inquiry'}
                  disabled={submitStatus === 'submitting'}
                  className={styles.submitButton}
                />

                <Text as="p" size="xs" className={styles.disclaimer}>
                  In order to respond to your inquiry, we will process the personal data you have
                  supplied in accordance with our{' '}
                  <a href="/privacy-policy" className={styles.link}>
                    privacy policy
                  </a>
                  .
                </Text>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default InquireSidebar
