/**
 * @alaq/atom - Orbit Configuration
 */

export const ORBIT_SYMBOL = Symbol.for('atom:orbit')

export interface Orbit<T = any> {
  kind: string
  value: T
  options?: Record<string, any>
  [ORBIT_SYMBOL]: true
}

/**
 * Define a property kind configuration
 * 
 * @param kind - Type of reactivity (e.g., "nucleus", "stored", "deep")
 * @param value - Initial value
 * @param options - Additional configuration for the kind
 */
export function kind<T>(kind: string, value: T, options?: Record<string, any>): Orbit<T> {
  return {
    kind,
    value,
    options,
    [ORBIT_SYMBOL]: true
  }
}

/**
 * Check if a value is an Orbit configuration
 */
export function isOrbit(value: any): value is Orbit {
  return value && value[ORBIT_SYMBOL] === true
}
