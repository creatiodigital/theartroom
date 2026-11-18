'use client'

import { useEffect, useMemo, useRef } from 'react'

import { peekPrintReturnUrl } from '@/components/checkout/printReturnUrl'
import { CURRENCY, editionCategory, euros } from '@/lib/analytics/events'
import { track } from '@/lib/analytics/track'

// A slider sends a change per step while dragged: report the value the buyer stops on.
const SETTLE_MS = 1500

type WizardArtwork = { slug: string; editionType: 'open' | 'limited' }

/** Where the wizard was opened from (the return URL "Order a print" stored), or the cart's Edit. */
const entrySource = (slug: string, editing: boolean): string => {
  if (editing) return 'cart_edit'
  const from = peekPrintReturnUrl(slug)
  if (!from) return 'direct'
  if (/^\/exhibitions\/[^/]+\/[^/]+\/visit/.test(from)) return 'room'
  if (from.startsWith('/artworks/')) return 'artwork_page'
  return 'other'
}

/**
 * GA4 events of the print wizard (docs/analytics/README.md): `print_wizard_open` once per opening,
 * and `print_option_change` for what the buyer changes (never the defaults it opens with).
 */
export const useWizardAnalytics = (
  artwork: WizardArtwork,
  openingPriceCents: number | null,
  editing = false,
) => {
  const opened = useRef(false)
  useEffect(() => {
    if (opened.current) return
    opened.current = true
    track('print_wizard_open', {
      item_id: artwork.slug,
      item_category: editionCategory(artwork.editionType),
      source: entrySource(artwork.slug, editing),
      currency: CURRENCY,
      value: openingPriceCents ? euros(openingPriceCents) : undefined,
    })
    // Once per mount, with what it opened on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((timer) => clearTimeout(timer))
  }, [])

  return useMemo(() => {
    const send = (option: string, choice: string) =>
      track('print_option_change', { item_id: artwork.slug, option, choice })
    const settle = (option: string, choice: string) => {
      clearTimeout(timers.current.get(option))
      timers.current.set(
        option,
        setTimeout(() => send(option, choice), SETTLE_MS),
      )
    }
    return {
      /** Dropdowns, chips and cards: one event per option the buyer picked. */
      choice: (patch: Record<string, string>) => {
        for (const [option, choice] of Object.entries(patch)) send(option, choice)
      },
      /** The print size (height × width, cm), once the slider or inputs settle. */
      size: (size: { widthCm: number; heightCm: number }) =>
        settle('size', `${Math.round(size.heightCm)}×${Math.round(size.widthCm)} cm`),
      /** A border or passepartout width, once it settles. */
      border: (dimensionId: string, allCm: number) => settle(dimensionId, `${allCm} cm`),
      /** "What is an open / limited edition?" */
      learnMore: () => track('print_help_open', { item_id: artwork.slug }),
    }
  }, [artwork.slug])
}
