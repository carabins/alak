/**
 * Core fusion implementation - internal utilities
 * @module @alaq/nucl/fusion/core
 */

import { createNu } from '../createNu'
import type { Strategy } from './strategies'

type AnyNucl = any

/**
 * Create fusion with given strategy (internal)
 *
 * Creates a reactive computed value that updates when source nucls change.
 * The strategy determines when recomputation should occur.
 */
export function createFusionWithStrategy<R>(
  sources: AnyNucl[],
  fn: (...values: any[]) => R,
  strategy: Strategy
): any {
  // Create result Nucl
  const result = createNu<R | undefined>(undefined)

  // Track which sources have decayed
  const decayedSources = new Set<AnyNucl>()

  // Compute function
  const compute = () => {
    // If any source has decayed, don't compute and set result to undefined
    if (decayedSources.size > 0) {
      result(undefined)
      return
    }

    if (strategy(sources)) {
      const values = sources.map(s => s.value)
      const newValue = fn(...values)
      result(newValue)
    }
  }

  // Initial computation
  compute()

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

  // Auto-cleanup when any source decays
  sources.forEach(source => {
    const originalDecay = source.decay
    source.decay = function() {
      if (!this._decayed) {  // Prevent multiple calls to decay
        cleanups.forEach(c => c())
        decayedSources.add(this)  // Mark this source as decayed
        result(undefined)  // Set result to undefined when a source decays
        this._decayed = true
      }
      return originalDecay.call(this)
    }
  })

  return result
}

/**
 * Create effect with strategy (internal)
 *
 * Creates a side-effect that runs when source nucls change.
 * Unlike fusion, effects don't create a new nucl - they just run callbacks.
 */
export function createEffectWithStrategy(
  sources: AnyNucl[],
  fn: (...values: any[]) => void,
  strategy: Strategy
): () => void {
  // Effect function
  const runEffect = () => {
    if (strategy(sources)) {
      const values = sources.map(s => s.value)
      fn(...values)
    }
  }

  // Run immediately
  runEffect()

  // Subscribe to all sources
  const listeners: Array<{ source: any, listener: any }> = []
  let skipCount = sources.length  // Skip immediate .up() callbacks

  sources.forEach(source => {
    const listener = () => {
      if (skipCount > 0) {
        skipCount--
        return
      }
      runEffect()
    }
    source.up(listener)
    listeners.push({ source, listener })
  })

  // Return cleanup function
  return () => {
    listeners.forEach(({ source, listener }) => {
      source.down(listener)
    })
  }
}
