

import { createNu } from '../createNu'
import { strategies } from './strategies'
import type { NuFusionBuilder } from './types'

type AnyNucl = any

const FUSION_KIND_NAME = "fusion"


class NuFusionBuilderImpl<Sources extends any[]> implements NuFusionBuilder<Sources> {
  constructor(
    private nucl: any,
    private sources: AnyNucl[]
  ) {}

  alive<R>(fn: (...values: Sources) => R): void {
    this.setupFusion(fn, strategies.alive)
  }

  some<R>(fn: (...values: Sources) => R): void {
    
    this.setupFusion(fn, strategies.alive)
  }

  any<R>(fn: (...values: Sources) => R): void {
    this.setupFusion(fn, strategies.any)
  }

  private setupFusion(fn: Function, strategy: any): void {
    const sources = this.sources
    const nucl = this.nucl

    
    const decayedSources = new Set<any>()

    
    const compute = () => {
      
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

    
    const cleanups: Array<() => void> = []
    let skipCount = sources.length  

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

    
    compute()

    
    sources.forEach(source => {
      const originalSourceDecay = source.decay
      source.decay = function() {
        if (!this._decayed) {  
          cleanups.forEach(c => c())
          decayedSources.add(this)  
          nucl(undefined)  
          this._decayed = true
        }
        return originalSourceDecay.call(this)
      }
    })

    
    nucl._fusionCleanup = () => {
      cleanups.forEach(c => c())
    }
  }
}


export function NuFusion<T = any>(): any {
  const nucl = createNu<T>({ kind: FUSION_KIND_NAME })

  
  nucl.from = function(...sources: AnyNucl[]) {
    return new NuFusionBuilderImpl(nucl, sources)
  }

  return nucl
}
