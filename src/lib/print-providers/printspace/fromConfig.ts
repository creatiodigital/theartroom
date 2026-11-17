import type { WizardConfig } from '../types'
import { TPS_PAPERS, TPS_SIZE_BOUNDS } from './data'
import type { PrintSize } from './sizeBounds'

/**
 * The paper an open edition's "From" price is quoted on. `getPrintBaseCents` interpolates on AREA
 * alone (paper does not change the price), so it only has to be a valid id; taken from the catalog
 * rather than hardcoded so it can't go stale if the first paper is ever swapped.
 */
export const REFERENCE_PAPER = TPS_PAPERS[0]

/** Up to the size fields' grid (0.1 cm), never below the smallest printable size. */
const upToGrid = (cm: number) => {
  const steps = 1 / TPS_SIZE_BOUNDS.stepCm
  return Math.ceil(Math.round(cm * steps * 1000) / 1000) / steps
}

/**
 * The configuration an open edition's "From €…" is the price of, and the one the print
 * configurator opens at (owner, 2026-11-17: "350 on the artwork page → open the wizard → 570"
 * scared buyers): unframed, the smallest printable size, the reference paper, no border. ONE
 * definition, so the artwork page's price and the configurator's first price cannot drift apart.
 *
 * The size is taken up to the 0.1 cm grid the configurator stores sizes on, so both price the
 * very same, buyable size (26.666… cm would be quoted, but 26.7 cm is what can be ordered).
 */
export function openEditionFromConfig(smallest: PrintSize): WizardConfig {
  return {
    values: {
      printType: REFERENCE_PAPER.printType,
      paper: REFERENCE_PAPER.id,
      format: 'print-only',
    },
    customSize: { widthCm: upToGrid(smallest.widthCm), heightCm: upToGrid(smallest.heightCm) },
    borders: { border: { allCm: 0 } },
  }
}
