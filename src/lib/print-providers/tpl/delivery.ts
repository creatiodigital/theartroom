import type { DeliveryEstimate, WizardConfig } from '../types'
import {
  GALLERY_ADMIN_DAYS,
  TPL_PRODUCTION_DAYS,
  TPL_SHIPPING_DAYS,
  resolveTplRegion,
  workingToCalendar,
} from './pricing'

/**
 * End-to-end delivery estimate for a TPL-routed order. Calendar-day
 * range covering: gallery admin processing + TPL production +
 * shipping window. Depends on chosen format (framing takes
 * significantly longer than print-only) and destination region.
 *
 * Pure function — safe to call from client components.
 */
export function estimateTplDelivery(config: WizardConfig, country: string): DeliveryEstimate {
  const region = resolveTplRegion(country)
  const isFramed = config.values.format === 'framing'
  const productionDays = isFramed ? TPL_PRODUCTION_DAYS.framing : TPL_PRODUCTION_DAYS.printOnly
  const shipping = TPL_SHIPPING_DAYS[region]
  const minWorking = GALLERY_ADMIN_DAYS + productionDays + shipping.min
  const maxWorking = GALLERY_ADMIN_DAYS + productionDays + shipping.max
  return {
    minDays: workingToCalendar(minWorking),
    maxDays: workingToCalendar(maxWorking),
  }
}
