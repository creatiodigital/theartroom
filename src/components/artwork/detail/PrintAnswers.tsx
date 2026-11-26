'use client'

import { useId, useState, type ReactNode } from 'react'
import { Minus, Plus } from '@phosphor-icons/react'

import { ArrowLink } from '@/components/ui/ArrowLink'
import { Button } from '@/components/ui/Button'
import { TPS_SUPPORTED_COUNTRIES } from '@/lib/print-providers/printspace/pricing'

import styles from './PrintAnswers.module.scss'

type Answer = { label: string; paragraphs: ReactNode[]; link?: { href: string; label: string } }

/**
 * The answers, in the owner's words (docs/take-a-peek/README.md T7, facts confirmed 2026-11-26).
 * Only this work's edition: a limited edition gets the certificate and is sold unframed; an open
 * edition gets the gallery's letter and may come framed.
 */
const answers = (editionType: 'open' | 'limited'): Answer[] => [
  {
    label: 'What’s in the box',
    paragraphs: [
      'Your print on archival fine-art paper. Unframed prints travel flat between card, wrapped in tissue and sealed.',
      editionType === 'limited'
        ? 'A certificate of authenticity with the same number as the print and the artist’s printed signature.'
        : 'A personal letter from the gallery.',
      ...(editionType === 'open' ? ['The frame and passepartout, if you chose them.'] : []),
    ],
  },
  {
    label: 'Production time',
    paragraphs: [
      'Every print is made to order, just for you, by our fine-art print partner. It usually ships within 2 weeks of your order.',
      'You get an email with tracking as soon as it ships.',
    ],
  },
  {
    label: 'Shipping',
    paragraphs: [
      // The count is the print partner's list; the regions are written out (they change rarely).
      `Shipped with tracking from the UK, Germany or the US, to ${TPS_SUPPORTED_COUNTRIES.length} countries: the EU, the UK, Switzerland, Norway, Iceland, Liechtenstein, the US, Canada, Australia, New Zealand, Japan and South Korea.`,
      // As `mayOweImportDuty` (src/lib/emails/delivery.ts). No delivery estimate is promised at
      // checkout since T6b, so only the cost is mentioned (questions Q3).
      'The shipping cost for your address is shown at checkout, before you pay. Outside the EU, the UK and the US, import duties may apply on delivery.',
    ],
  },
  {
    label: 'Returns',
    paragraphs: [
      'If your print arrives damaged, faulty or not what you ordered, write to us within 7 days of delivery with a few photos, and we’ll replace it or refund you.',
      'Because each print is made for you, we can’t take it back for a change of mind. You can cancel free of charge until production starts.',
    ],
    link: { href: '/terms-of-sale', label: 'Online terms of sale' },
  },
]

/**
 * Folded answers under Order a print (docs/take-a-peek/README.md T7; designs/ArtworkReassurance):
 * what's in the box, production time, shipping, returns. All closed at first, one open at a time;
 * each row a heading with a button that shows its panel.
 */
export const PrintAnswers = ({ editionType }: { editionType: 'open' | 'limited' }) => {
  const [open, setOpen] = useState<number | null>(null)
  const id = useId()

  return (
    <div className={styles.answers}>
      {answers(editionType).map((answer, index) => {
        const isOpen = open === index
        const buttonId = `${id}-row-${index}`
        const panelId = `${id}-panel-${index}`
        const Icon = isOpen ? Minus : Plus
        return (
          <div key={answer.label} className={styles.item}>
            <h2 className={styles.heading}>
              <Button
                variant="bare"
                id={buttonId}
                className={styles.row}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : index)}
              >
                <span className={styles.label}>{answer.label}</span>
                <Icon size={16} weight="light" aria-hidden className={styles.icon} />
              </Button>
            </h2>
            {/* Always in the page, so its height can ease open; inert (out of reach) while shut. */}
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className={styles.panel}
              data-open={isOpen || undefined}
              inert={!isOpen}
            >
              <div className={styles.panelInner}>
                <div className={styles.panelBody}>
                  {answer.paragraphs.map((paragraph, i) => (
                    <p key={i} className={styles.paragraph}>
                      {paragraph}
                    </p>
                  ))}
                  {answer.link && (
                    <ArrowLink href={answer.link.href} size="small">
                      {answer.link.label}
                    </ArrowLink>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
