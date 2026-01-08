

import { createEffectWithStrategy } from './core'
import { strategies } from './strategies'

type AnyNucl = any


export function aliveFusion<A>(
  sources: [any],
  fn: (a: A) => void
): () => void

export function aliveFusion<A, B>(
  sources: [any, any],
  fn: (a: A, b: B) => void
): () => void

export function aliveFusion<A, B, C>(
  sources: [any, any, any],
  fn: (a: A, b: B, c: C) => void
): () => void

export function aliveFusion<A, B, C, D>(
  sources: [any, any, any, any],
  fn: (a: A, b: B, c: C, d: D) => void
): () => void

export function aliveFusion<A, B, C, D, E>(
  sources: [any, any, any, any, any],
  fn: (a: A, b: B, c: C, d: D, e: E) => void
): () => void

export function aliveFusion(sources: AnyNucl[], fn: Function): () => void {
  return createEffectWithStrategy(sources, fn as any, strategies.alive)
}


export function anyFusion<A>(
  sources: [any],
  fn: (a: A) => void
): () => void

export function anyFusion<A, B>(
  sources: [any, any],
  fn: (a: A, b: B) => void
): () => void

export function anyFusion<A, B, C>(
  sources: [any, any, any],
  fn: (a: A, b: B, c: C) => void
): () => void

export function anyFusion<A, B, C, D>(
  sources: [any, any, any, any],
  fn: (a: A, b: B, c: C, d: D) => void
): () => void

export function anyFusion<A, B, C, D, E>(
  sources: [any, any, any, any, any],
  fn: (a: A, b: B, c: C, d: D, e: E) => void
): () => void

export function anyFusion(sources: AnyNucl[], fn: Function): () => void {
  return createEffectWithStrategy(sources, fn as any, strategies.any)
}
