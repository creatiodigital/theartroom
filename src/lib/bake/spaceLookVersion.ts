import { canonicalJson, fnv1a } from './hash'
import { spaceLooks } from './spaceLooks'

/**
 * Short stable hash of a space's look data — its fixed camera and its look (lamp ratings,
 * daylight, sun, paint, the floor and every value it owns) — so recalibrating a space stales its
 * bakes.
 */
export function spaceLookVersion(spaceId: string): string {
  return fnv1a(canonicalJson(spaceLooks[spaceId] ?? {}))
}
