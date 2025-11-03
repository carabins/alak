/**
 * fusion - Standalone fusion builder with explicit strategies
 * @module @alaq/nucl/fusion
 */

import { createFusionWithStrategy } from './core'
import { strategies } from './strategies'

type AnyNucl = any

/**
 * fusion builder
 *
 * Provides a fluent API for creating computed values with explicit strategy selection.
 * Creates a new Nucl that automatically updates when source nucls change.
 *
 * @example
 * const a = Nu(null)
 * const b = Nu(2)
 * // With 'any' strategy - recomputes even when a is null
 * const result = fusion(a, b).any((a, b) => (a || 0) + b)
 */
export class FusionBuilder {
  constructor(private sources: AnyNucl[]) {}

  /**
   * alive strategy - recompute only when all sources are truthy
   *
   * @example
   * fusion(a, b).alive((a, b) => a + b)
   */
  alive<R>(fn: (...values: any[]) => R): any {
    return createFusionWithStrategy(this.sources, fn, strategies.alive)
  }

  /**
   * any strategy - recompute on all changes
   *
   * @example
   * fusion(a, b).any((a, b) => (a || 0) + (b || 0))
   */
  any<R>(fn: (...values: any[]) => R): any {
    return createFusionWithStrategy(this.sources, fn, strategies.any)
  }
}

/**
 * fusion - Create computed values with explicit strategy selection
 *
 * Create a fusion builder that allows you to choose the computation strategy.
 * Returns a new Nucl that automatically updates when sources change.
 *
 * @example
 * // alive strategy - only computes when all sources are truthy
 * const sum = fusion(a, b).alive((a, b) => a + b)
 *
 * // any strategy - always computes
 * const result = fusion(a, b).any((a, b) => (a || 0) + (b || 0))
 */
export function fusion<A>(a: any): FusionBuilder
export function fusion<A, B>(a: any, b: any): FusionBuilder
export function fusion<A, B, C>(a: any, b: any, c: any): FusionBuilder
export function fusion<A, B, C, D>(a: any, b: any, c: any, d: any): FusionBuilder
export function fusion<A, B, C, D, E>(a: any, b: any, c: any, d: any, e: any): FusionBuilder

export function fusion(...sources: AnyNucl[]): FusionBuilder {
  return new FusionBuilder(sources)
}
