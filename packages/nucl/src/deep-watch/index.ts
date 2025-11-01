/**
 * @alaq/nucl/deep-watch - High-performance deep watching plugin for Nucl
 * 
 * Provides efficient deep property watching for nested objects and arrays
 * with minimal overhead and maximum speed.
 * 
 * Usage:
 * 
 * ```ts
 * import { Nucl } from '@alaq/nucl'
 * import { deepWatchPlugin, watchDeep, getDeep, setDeep } from '@alaq/nucl/deep-watch'
 * 
 * // Create Nucl with deep watch plugin
 * const nucl = Nucl({ 
 *   value: { 
 *     profile: { 
 *       name: 'John',
 *       details: {
 *         age: 30,
 *         address: {
 *           city: 'New York',
 *           zip: '10001'
 *         }
 *       }
 *     }
 *   },
 *   plugins: [deepWatchPlugin()]
 * })
 * 
 * // Watch for deep changes
 * const unsubscribe = watchDeep(nucl, 'profile.name', () => {
 *   console.log('Profile name changed to:', getDeep(nucl, 'profile.name'))
 * })
 * 
 * // Update deeply nested property
 * setDeep(nucl, 'profile.name', 'Jane') // Logs: "Profile name changed to: Jane"
 * 
 * // Get deeply nested value
 * const name = getDeep(nucl, 'profile.name') // 'Jane'
 * 
 * // Cleanup
 * unsubscribe()
 * ```
 */

export { 
  deepWatchPlugin, 
  watchDeep, 
  getDeep, 
  setDeep 
} from './deep-watch'

export type { 
  DeepWatchPluginOptions 
} from './deep-watch'