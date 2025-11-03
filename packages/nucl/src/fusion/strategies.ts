/**
 * Fusion strategies - determine when to recompute
 * @module @alaq/nucl/fusion/strategies
 */

type AnyNucl = any

/**
 * Strategy function - determines when to recompute based on source states
 */
export type Strategy = (sources: AnyNucl[]) => boolean

/**
 * Built-in strategies for fusion computations
 */
export const strategies = {
  /**
   * alive - Recompute only when all sources are truthy
   * Use this when you need all dependencies to have valid values
   */
  alive: (sources: AnyNucl[]) => {
    return sources.every(s => !!s.value)
  },

  /**
   * any - Recompute on any change (always)
   * Use this for computations that should always run regardless of source values
   */
  any: (_sources: AnyNucl[]) => {
    return true
  }
} as const

export type StrategyName = keyof typeof strategies
