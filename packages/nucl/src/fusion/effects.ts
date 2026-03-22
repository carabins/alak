

import { IQ } from '@alaq/quark'
import { createEffectWithStrategy } from './core'
import { strategies } from './strategies'

type AnyNucl = IQ


export function aliveFusion<A>(
  sources: [IQ<A>],
  fn: (a: A) => void
): () => void

export function aliveFusion<A, B>(
  sources: [IQ<A>, IQ<B>],
  fn: (a: A, b: B) => void
): () => void

export function aliveFusion<A, B, C>(
  sources: [IQ<A>, IQ<B>, IQ<C>],
  fn: (a: A, b: B, c: C) => void
): () => void

export function aliveFusion<A, B, C, D>(
  sources: [IQ<A>, IQ<B>, IQ<C>, IQ<D>],
  fn: (a: A, b: B, c: C, d: D) => void
): () => void

export function aliveFusion<A, B, C, D, E>(
  sources: [IQ<A>, IQ<B>, IQ<C>, IQ<D>, IQ<E>],
  fn: (a: A, b: B, c: C, d: D, e: E) => void
): () => void

export function aliveFusion(sources: AnyNucl[], fn: Function): () => void {
  return createEffectWithStrategy(sources, fn as any, strategies.alive)
}


export function anyFusion<A>(
  sources: [IQ<A>],
  fn: (a: A) => void
): () => void

export function anyFusion<A, B>(
  sources: [IQ<A>, IQ<B>],
  fn: (a: A, b: B) => void
): () => void

export function anyFusion<A, B, C>(
  sources: [IQ<A>, IQ<B>, IQ<C>],
  fn: (a: A, b: B, c: C) => void
): () => void

export function anyFusion<A, B, C, D>(
  sources: [IQ<A>, IQ<B>, IQ<C>, IQ<D>],
  fn: (a: A, b: B, c: C, d: D) => void
): () => void

export function anyFusion<A, B, C, D, E>(
  sources: [IQ<A>, IQ<B>, IQ<C>, IQ<D>, IQ<E>],
  fn: (a: A, b: B, c: C, d: D, e: E) => void
): () => void

export function anyFusion(sources: AnyNucl[], fn: Function): () => void {
  return createEffectWithStrategy(sources, fn as any, strategies.any)
}
