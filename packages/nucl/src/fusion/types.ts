

import type {INucleonCore} from '../INucleon'
import type { StrategyName } from './strategies'




export interface FusionMethods {
  
  fusion<R>(
    this: INucleonCore,
    ...args: [...sources: any[], fn: (...values: any[]) => R]
  ): INucleonCore

  
  fusion<R>(
    this: INucleonCore,
    ...args: [...sources: any[], strategy: StrategyName, fn: (...values: any[]) => R]
  ): INucleonCore
}


export type FusionProto = FusionMethods





export interface NuFusionBuilder<Sources extends any[]> {
  
  alive<R>(fn: (...values: Sources) => R): void

  
  some<R>(fn: (...values: Sources) => R): void

  
  any<R>(fn: (...values: Sources) => R): void
}
