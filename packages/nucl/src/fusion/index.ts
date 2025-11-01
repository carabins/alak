/**
 * Fusion - Computed values and reactive composition
 * @module @alaq/nucl/fusion
 */

import { Nucl } from '../index'

type AnyNucl = any

/**
 * Strategy function - determines when to recompute
 */
type Strategy = (sources: AnyNucl[]) => boolean

/**
 * Built-in strategies
 */
const strategies = {
  /**
   * alive - Recompute only when all sources are truthy
   */
  alive: (sources: AnyNucl[]) => {
    return sources.every(s => !!s.value)
  },

  /**
   * any - Recompute on any change (always)
   */
  any: (_sources: AnyNucl[]) => {
    return true
  }
}

/**
 * Create fusion with given strategy
 */
function createFusionWithStrategy<R>(
  sources: AnyNucl[],
  fn: (...values: any[]) => R,
  strategy: Strategy
): any {
  // Create result Nucl
  const result = Nucl<R | undefined>(undefined)

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

// ============ FUSION - Simple default (alive) ============

/**
 * Fusion - Create computed Nucl with alive strategy
 * Recomputes only when sources are truthy
 */
export function Fusion<A, R>(
  a: any,
  fn: (a: A) => R
): any

export function Fusion<A, B, R>(
  a: any,
  b: any,
  fn: (a: A, b: B) => R
): any

export function Fusion<A, B, C, R>(
  a: any,
  b: any,
  c: any,
  fn: (a: A, b: B, c: C) => R
): any

export function Fusion<A, B, C, D, R>(
  a: any,
  b: any,
  c: any,
  d: any,
  fn: (a: A, b: B, c: C, d: D) => R
): any

export function Fusion<A, B, C, D, E, R>(
  a: any,
  b: any,
  c: any,
  d: any,
  e: any,
  fn: (a: A, b: B, c: C, d: D, e: E) => R
): any

export function Fusion(...args: any[]): any {
  const fn = args[args.length - 1]
  const sources = args.slice(0, -1)

  return createFusionWithStrategy(sources, fn, strategies.alive)
}

// ============ NEOFUSION - Builder with strategies ============

/**
 * NeoFusion builder
 */
class NeoFusionBuilder {
  constructor(private sources: AnyNucl[]) {}

  /**
   * alive strategy - recompute when sources are truthy
   */
  alive<R>(fn: (...values: any[]) => R): any {
    return createFusionWithStrategy(this.sources, fn, strategies.alive)
  }

  /**
   * any strategy - recompute on all changes
   */
  any<R>(fn: (...values: any[]) => R): any {
    return createFusionWithStrategy(this.sources, fn, strategies.any)
  }
}

/**
 * NeoFusion - Advanced fusion with explicit strategies
 */
export function NeoFusion<A>(a: any): NeoFusionBuilder
export function NeoFusion<A, B>(a: any, b: any): NeoFusionBuilder
export function NeoFusion<A, B, C>(a: any, b: any, c: any): NeoFusionBuilder
export function NeoFusion<A, B, C, D>(a: any, b: any, c: any, d: any): NeoFusionBuilder
export function NeoFusion<A, B, C, D, E>(a: any, b: any, c: any, d: any, e: any): NeoFusionBuilder

export function NeoFusion(...sources: AnyNucl[]): NeoFusionBuilder {
  return new NeoFusionBuilder(sources)
}

// ============ UTILITIES - Side-effects only ============

/**
 * Create effect with strategy (internal)
 */
function createEffectWithStrategy(
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

/**
 * AliveFusion - Side-effect utility with alive strategy
 */
export function AliveFusion<A>(
  sources: [any],
  fn: (a: A) => void
): () => void

export function AliveFusion<A, B>(
  sources: [any, any],
  fn: (a: A, b: B) => void
): () => void

export function AliveFusion<A, B, C>(
  sources: [any, any, any],
  fn: (a: A, b: B, c: C) => void
): () => void

export function AliveFusion(sources: AnyNucl[], fn: Function): () => void {
  return createEffectWithStrategy(sources, fn as any, strategies.alive)
}

/**
 * AnyFusion - Side-effect utility with any strategy
 */
export function AnyFusion<A>(
  sources: [any],
  fn: (a: A) => void
): () => void

export function AnyFusion<A, B>(
  sources: [any, any],
  fn: (a: A, b: B) => void
): () => void

export function AnyFusion<A, B, C>(
  sources: [any, any, any],
  fn: (a: A, b: B, c: C) => void
): () => void

export function AnyFusion(sources: AnyNucl[], fn: Function): () => void {
  return createEffectWithStrategy(sources, fn as any, strategies.any)
}
