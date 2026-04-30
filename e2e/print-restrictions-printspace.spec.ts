import { test, expect } from '@playwright/test'

import { TPS_PAPERS } from '@/lib/print-providers/printspace/data'

import { getArtworkRestrictions, vetoedIds } from './db-helpers'
import { fixtures } from './fixtures'
import { openWizard, pickWizardOption, readWizardOptions } from './wizard-helpers'

/**
 * Per-artwork print-restriction contract — DB ↔ wizard.
 *
 * Artist veto state lives in `Artwork.printOptions` as the canonical
 * `PrintRestrictions` shape — `{ allowed: { paper: [...] } }`. This
 * spec reads that JSON live, derives the catalog labels the artist has
 * vetoed, opens the public wizard as a buyer, and asserts each vetoed
 * label is absent from the wizard's paper list under every print-type
 * branch.
 *
 * Sizes are intentionally not asserted: TPS exposes a continuous size
 * slider rather than preset checkboxes, so there is no veto surface
 * to test. Paper veto is the relevant contract here.
 *
 * Read-only: no checkbox toggled, no form submitted.
 */

interface TpsPrintOptions {
  allowed?: { [dimensionId: string]: string[] | undefined }
}

test('TPS: wizard hides papers the artist vetoed in the DB', async ({ page }) => {
  test.setTimeout(60_000)

  const slug = fixtures.artworkSlug
  const { printOptions } = await getArtworkRestrictions(slug)

  const opts = (printOptions ?? {}) as TpsPrintOptions
  const vetoedPaperLabels = vetoedIds(
    opts.allowed?.paper,
    TPS_PAPERS.map((p) => p.id),
  ).map((id) => TPS_PAPERS.find((p) => p.id === id)!.label)

  expect(
    vetoedPaperLabels.length,
    'fixture should have ≥1 vetoed paper so the test is meaningful',
  ).toBeGreaterThan(0)

  await openWizard(page, slug)

  // TPS bundles printType + paper into a single "Print" section with two
  // SelectDropdowns labeled "Type" and "Paper". Papers cascade on the
  // chosen print type (Giclée vs C-Type). Vetoed papers must be hidden
  // under either branch — iterate every print-type entry so the
  // assertion holds regardless of which branch the vetoed paper lives on.
  const printTypeLabels = await readWizardOptions(page, 'Print', 'Type')
  expect(printTypeLabels.length, 'TPS wizard should expose ≥1 print type').toBeGreaterThan(0)

  const seenPapers = new Set<string>()
  for (const printTypeLabel of printTypeLabels) {
    await pickWizardOption(page, 'Print', printTypeLabel, 'Type')
    const papersUnderType = await readWizardOptions(page, 'Print', 'Paper')
    for (const label of vetoedPaperLabels) {
      expect(
        papersUnderType,
        `vetoed paper "${label}" should NOT appear under print type "${printTypeLabel}"`,
      ).not.toContain(label)
    }
    papersUnderType.forEach((p) => seenPapers.add(p))
  }

  expect(seenPapers.size, 'TPS wizard should expose ≥1 paper across print types').toBeGreaterThan(0)
})
