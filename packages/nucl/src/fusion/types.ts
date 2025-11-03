/**
 * Fusion Plugin Types
 *
 * Type definitions for fusion plugin methods and NuFusion builder.
 */

import type INucleusQuark from '../types/core'
import type { StrategyName } from './strategies'

// ============ FUSION METHODS ============
// Added to Nucl prototype when fusionPlugin is installed

export interface FusionMethods {
  /**
   * Convert this Nucl into a computed fusion of other nucls
   * Uses 'alive' strategy by default (recomputes only when all sources are truthy)
   *
   * @example
   * ```typescript
   * const result = Nucl()
   * result.fusion(a, b, (a, b) => a + b)
   * ```
   */
  fusion<R>(
    this: INucleusQuark<R>,
    ...args: [...sources: any[], fn: (...values: any[]) => R]
  ): INucleusQuark<R>

  /**
   * Convert this Nucl into a computed fusion with explicit strategy
   *
   * @example
   * ```typescript
   * const result = Nucl()
   * result.fusion(a, b, 'any', (a, b) => (a || 0) + (b || 0))
   * ```
   */
  fusion<R>(
    this: INucleusQuark<R>,
    ...args: [...sources: any[], strategy: StrategyName, fn: (...values: any[]) => R]
  ): INucleusQuark<R>
}

/**
 * Complete Fusion Proto
 */
export type FusionProto = FusionMethods

// ============ NU FUSION BUILDER ============
// For NuFusion().from(...).alive() API

/**
 * NuFusion builder after calling .from()
 * Allows selection of computation strategy
 */
export interface NuFusionBuilder<Sources extends any[]> {
  /**
   * alive strategy - recompute only when all sources are truthy
   * Alias: some()
   *
   * @example
   * ```typescript
   * nu.from(a, b).alive((a, b) => a + b)
   * ```
   */
  alive<R>(fn: (...values: Sources) => R): void

  /**
   * some strategy - alias for alive()
   * Recompute only when all sources are truthy
   *
   * @example
   * ```typescript
   * nu.from(a, b).some((a, b) => a + b)
   * ```
   */
  some<R>(fn: (...values: Sources) => R): void

  /**
   * any strategy - recompute on all changes (even if sources are falsy)
   *
   * @example
   * ```typescript
   * nu.from(a, b).any((a, b) => (a || 0) + (b || 0))
   * ```
   */
  any<R>(fn: (...values: Sources) => R): void
}
