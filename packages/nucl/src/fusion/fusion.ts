

import { createFusionWithStrategy } from './core'
import { strategies } from './strategies'

type AnyNucl = any


export class FusionBuilder {
  constructor(private sources: AnyNucl[]) {}

  
  alive<R>(fn: (...values: any[]) => R): any {
    return createFusionWithStrategy(this.sources, fn, strategies.alive)
  }

  
  any<R>(fn: (...values: any[]) => R): any {
    return createFusionWithStrategy(this.sources, fn, strategies.any)
  }
}


export function fusion<A>(a: any): FusionBuilder
export function fusion<A, B>(a: any, b: any): FusionBuilder
export function fusion<A, B, C>(a: any, b: any, c: any): FusionBuilder
export function fusion<A, B, C, D>(a: any, b: any, c: any, d: any): FusionBuilder
export function fusion<A, B, C, D, E>(a: any, b: any, c: any, d: any, e: any): FusionBuilder

export function fusion(...sources: AnyNucl[]): FusionBuilder {
  return new FusionBuilder(sources)
}
