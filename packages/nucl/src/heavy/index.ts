/**
 * Heavy preset - All plugins and utilities
 *
 * Entry point: @alaq/nucl/heavy
 *
 * Includes:
 * - Nucleus plugin (universal + array + object methods)
 * - Fusion (computed values and reactive composition)
 * - HeavyNucl - Pre-configured Nucl factory with all plugins
 *
 * @module @alaq/nucl/heavy
 */

import { Nucl, use, NuclProto } from '../index'
import { nucleusPlugin } from '../nucleus'
import type { QuOptions } from '@alaq/quark'

// Auto-install all plugins
use(nucleusPlugin)

/**
 * HeavyNucl - Factory function that always includes all plugins
 *
 * This is a convenience function that ensures all plugins are available
 * without needing to call use() separately. Perfect for applications
 * that want the full feature set.
 *
 * @example
 * import { HeavyNucl } from '@alaq/nucl/heavy'
 *
 * const arr = HeavyNucl([1, 2, 3])
 * arr.push(4)  // nucleus plugin methods available
 * console.log(arr.size)  // 4
 */
export function HeavyNucl<T = any>(options?: QuOptions<T> | T): any {
  return Nucl(options)
}

// HeavyNucl shares the same prototype as Nucl (with all plugins installed)
Object.setPrototypeOf(HeavyNucl, Nucl)

// Export everything
export { Nucl, use, nucleusPlugin }
export * from '../fusion'
