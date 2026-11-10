/**
 * Public surface of the provider abstraction: types, formatters, the
 * availability dispatcher and the config helpers. The catalog is loaded through
 * `loadCatalog.ts`, a server action in its own file.
 */
export type {
  AvailabilityCheck,
  BorderDimension,
  Catalog,
  Dimension,
  EnumDimension,
  Option,
  PrintRecommendations,
  PrintRestrictions,
  ProviderId,
  Quote,
  SizeDimension,
  SizeOption,
  WizardConfig,
} from './types'

export { formatDualDimensions, formatEuro } from './format'

export { buildAvailability } from './availability'

export {
  buildInitialConfig,
  clampCm,
  collectVisualHints,
  configShipsTo,
  getEffectiveBorderCm,
  getEffectiveMatCm,
  getEffectiveSizeCm,
  isDimensionVisible,
  isOptionPickable,
  isOptionVisible,
} from './configHelpers'

export { summarizeConfig } from './specs'
export type { SpecsSummary } from './specs'

export { findConfigRestrictionClash } from './checkConfigRestrictions'
