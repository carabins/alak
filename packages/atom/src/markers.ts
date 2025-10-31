/**
 * @alaq/atom - Marker composition utilities
 */

const SYNTHESIS_SYMBOL = Symbol.for('atom:synthesis')

/**
 * Compose multiple property markers
 *
 * @example
 * ```ts
 * import { synthesis } from '@alaq/atom'
 * import { saved } from '@alaq/atom-persist'
 * import { tag } from '@alaq/atom-meta'
 *
 * class User {
 *   email = synthesis(saved(''), tag('contact'))
 * }
 * ```
 */
export function synthesis(...markers: any[]) {
  // Extract value from first marker that has it
  let value = undefined
  for (const marker of markers) {
    if (marker?.value !== undefined) {
      value = marker.value
      break
    }
  }

  return {
    _marker: SYNTHESIS_SYMBOL,
    _isComposed: true,
    value,
    markers
  }
}

/**
 * Check if value is a synthesis composition
 */
export function isSynthesis(value: any): boolean {
  return value?._marker === SYNTHESIS_SYMBOL && value?._isComposed === true
}

/**
 * Extract markers from value (handles synthesis and single markers)
 */
export function extractMarkers(value: any): any[] {
  if (isSynthesis(value)) {
    return value.markers
  }

  if (Array.isArray(value)) {
    return value
  }

  // Single marker
  if (value?._marker) {
    return [value]
  }

  return []
}
