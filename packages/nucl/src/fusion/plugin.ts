/**
 * Fusion Plugin - Add .fusion() method to NuclProto
 * @module @alaq/nucl/fusion/plugin
 */

import type { INucleonPlugin } from '../INucleonPlugin'
import { strategies, type StrategyName } from './strategies'

type AnyNucl = any

/**
 * Fusion plugin - adds .fusion() method to Nucl instances
 *
 * @example
 * import { use } from '@alaq/nucl'
 * import { fusionPlugin } from '@alaq/nucl/fusion/plugin'
 *
 * use(fusionPlugin)
 *
 * // Now you can use .fusion() method
 * const result = Nucl()
 * result.fusion(a, b, (a, b) => a + b)
 *
 * // Or with explicit strategy
 * result.fusion(a, b, 'any', (a, b) => a + b)
 */
export const fusionPlugin: INucleonPlugin = {
  name: 'fusion',
  symbol: Symbol('fusion'),

  methods: {
    /**
     * Make this nucl behave as a fusion of other nucls
     *
     * This method converts the current Nucl into a computed value that updates
     * when the source nucls change.
     *
     * @example
     * const result = Nucl()
     * result.fusion(a, b, (a, b) => a + b)
     *
     * // With explicit strategy
     * result.fusion(a, b, 'any', (a, b) => (a || 0) + (b || 0))
     */
    fusion(this: any, ...args: any[]) {
      // Extract the function (last argument) and strategy (second to last, optional)
      const fn = args[args.length - 1]
      const sources = args.slice(0, -1).filter(arg => typeof arg !== 'string')
      const strategyName = args.length > 2 && typeof args[args.length - 2] === 'string'
        ? args[args.length - 2]
        : 'alive' // default to 'alive' strategy

      // Get the appropriate strategy function
      const strategy = strategies[strategyName as StrategyName]
      if (!strategy) {
        throw new Error(`Unknown fusion strategy: ${strategyName}`)
      }

      // Track which sources have decayed
      const decayedSources = new Set<any>()

      // Compute function
      const self = this
      const compute = () => {
        // If any source has decayed, don't compute and set result to undefined
        if (decayedSources.size > 0) {
          self(undefined)
          return
        }

        if (strategy(sources)) {
          const values = sources.map(s => s.value)
          const newValue = fn(...values)
          self(newValue)
        }
      }

      // Subscribe to all sources
      const cleanups: Array<() => void> = []
      let skipCount = sources.length  // Skip immediate .up() callbacks for all sources

      sources.forEach(source => {
        const listener = () => {
          if (skipCount > 0) {
            skipCount--
            return
          }
          compute()
        }
        source.up(listener)
        cleanups.push(() => source.down(listener))
      })

      // Initial computation after setting up listeners (but before skipping)
      compute()

      // Auto-cleanup when any source decays
      sources.forEach(source => {
        const originalSourceDecay = source.decay
        source.decay = function() {
          if (!this._decayed) {  // Prevent multiple calls to decay
            cleanups.forEach(c => c())
            decayedSources.add(this)  // Mark this source as decayed
            self(undefined)  // Set result to undefined when a source decays
            this._decayed = true
          }
          return originalSourceDecay.call(this)
        }
      })

      // Store cleanup function to allow manual cleanup if needed
      self._fusionCleanup = () => {
        cleanups.forEach(c => c())
      }

      return this
    }
  }
}
