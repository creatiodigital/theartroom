/**
 * The passepartout board's thickness (cm), wherever it is set, read back or drawn: the editor's
 * slider, the mapper reading it from the API, the details panel and the 3D displays. AR-165
 * (Eduardo 2026-10-23): down to 0.1 cm. The old floor was copied into five places; one missed
 * copy turned a saved 0.1 back into 0.6.
 */
export const PASSEPARTOUT_THICKNESS = { min: 0.1, max: 3 } as const

/** A thickness the editor can set (both ends included). */
export const isPassepartoutThickness = (value: number | null | undefined): value is number =>
  typeof value === 'number' &&
  value >= PASSEPARTOUT_THICKNESS.min &&
  value <= PASSEPARTOUT_THICKNESS.max
