'use client'

import { useId } from 'react'
import { Camera } from '@phosphor-icons/react'

import { CheckoutButton } from '@/components/checkout/CheckoutParts'
import { Modal } from '@/components/ui/Modal'

import styles from './UnboxingReminderModal.module.scss'

type UnboxingReminderModalProps = {
  onClose: () => void
}

/**
 * Shown once on the confirmation step, right after the order is confirmed.
 *
 * Why here and not at the pay button: a blocking gate before payment adds
 * friction at the moment of purchase, and it lands ~3 weeks before the parcel
 * does — far too early to be recalled. This spot costs the buyer nothing and
 * catches them while they're still paying attention; the shipped + delivered
 * emails carry the same request when the box is actually at the door.
 *
 * The request is a suggestion, never a condition. Transit damage is the
 * seller's risk until the buyer takes possession, so a claim without footage
 * still has to be honoured — what the images actually buy us is a same-day
 * reprint decision and a claim against the carrier.
 */
export const UnboxingReminderModal = ({ onClose }: UnboxingReminderModalProps) => {
  const titleId = useId()

  // order-flow.md "A small request"; designs/order-unboxing-request.dc.html: 520 px.
  return (
    <Modal onClose={onClose} titleId={titleId} maxWidth="520px" showClose>
      <div className={styles.body}>
        <span className={styles.icon} aria-hidden>
          <Camera size={26} weight="light" />
        </span>

        <h2 id={titleId} className={styles.title}>
          A small request
        </h2>

        <p className={styles.paragraph}>
          We kindly suggest taking a few photos, or a short video, as you unwrap your print: the
          sealed parcel first, then the moment you open it.
        </p>
        <p className={styles.paragraph}>
          Damage in transit is rare and your print travels well protected. But should anything
          arrive less than perfect, those images let us arrange a reprint or a refund right away,
          with no back-and-forth.
        </p>

        <p className={styles.footnote}>We&apos;ll remind you again when your print ships.</p>

        <CheckoutButton label="Got it" onClick={onClose} className={styles.gotIt} />
      </div>
    </Modal>
  )
}
