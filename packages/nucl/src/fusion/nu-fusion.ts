/**
 * NuFusion - Nucl-based fusion builder
 * @module @alaq/nucl/fusion/nu-fusion
 */

import { createNu } from '../createNu'
import { strategies } from './strategies'
import type { NuFusionBuilder } from './types'

type AnyNucl = any

const FUSION_REALM = "__fusion_realm__"

/**
 * NuFusion builder implementation
 * Created by calling NuFusion<T>().from(...)
 */
class NuFusionBuilderImpl<Sources extends any[]> implements NuFusionBuilder<Sources> {
  constructor(
    private nucl: any,
    private sources: AnyNucl[]
  ) {}

  alive<R>(fn: (...values: Sources) => R): void {
    this.setupFusion(fn, strategies.alive)
  }

  some<R>(fn: (...values: Sources) => R): void {
    // 'some' is alias for 'alive'
    this.setupFusion(fn, strategies.alive)
  }

  any<R>(fn: (...values: Sources) => R): void {
    this.setupFusion(fn, strategies.any)
  }

  private setupFusion(fn: Function, strategy: any): void {
    const sources = this.sources
    const nucl = this.nucl

    // Track which sources have decayed
    const decayedSources = new Set<any>()

    // Compute function
    const compute = () => {
      // If any source has decayed, don't compute and set result to undefined
      if (decayedSources.size > 0) {
        nucl(undefined)
        return
      }

      if (strategy(sources)) {
        const values = sources.map(s => s.value)
        const newValue = fn(...values)
        nucl(newValue)
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
          nucl(undefined)  // Set result to undefined when a source decays
          this._decayed = true
        }
        return originalSourceDecay.call(this)
      }
    })

    // Store cleanup function to allow manual cleanup if needed
    nucl._fusionCleanup = () => {
      cleanups.forEach(c => c())
    }
  }
}

/**
 * NuFusion - Nucl with fusion builder API
 *
 * Create a Nucl that can be configured as a computed value
 * using the fluent .from().alive()/.any() API.
 *
 * @example
 * ```typescript
 * const sum = NuFusion<number>()
 * sum.from(a, b).alive((a, b) => a + b)
 *
 * // With 'some' alias
 * sum.from(a, b).some((a, b) => a + b)
 *
 * // With 'any' strategy
 * const safe = NuFusion<number>()
 * safe.from(a, b).any((a, b) => (a || 0) + (b || 0))
 * ```
 */
export function NuFusion<T = any>(): any {
  const nucl = createNu<T>({ kind: FUSION_REALM })

  // Add .from() method that returns builder
  nucl.from = function(...sources: AnyNucl[]) {
    return new NuFusionBuilderImpl(nucl, sources)
  }

  return nucl
}
