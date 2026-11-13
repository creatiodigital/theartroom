'use client'

import { useState } from 'react'

import { Band } from '@/components/ui/Band'
import { Button } from '@/components/ui/Button'

import { FeedbackWindow } from './FeedbackWindow'

/**
 * "We'd love to hear from you" (docs/public-redesign/home.md §7, feedback.md): the homepage's
 * off-white band, centred, with Give feedback opening the feedback window.
 */
export const FeedbackBand = () => {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Band
        align="center"
        heading="We’d love to hear from you"
        line="Tell us what you loved about our new website and our 3D rooms, and what we could do better."
        action={
          <Button
            variant="primary"
            size="bigSquared"
            label="Give feedback"
            aria-haspopup="dialog"
            onClick={() => setOpen(true)}
          />
        }
      />
      {open && <FeedbackWindow source="home" onClose={() => setOpen(false)} />}
    </>
  )
}
