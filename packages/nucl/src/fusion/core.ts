

import { createNu } from '../createNu'
import type { Strategy } from './strategies'

type AnyNucl = any


export function createFusionWithStrategy<R>(
  sources: AnyNucl[],
  fn: (...values: any[]) => R,
  strategy: Strategy
): any {
  
  const result = createNu<R | undefined>(undefined)

  
  const decayedSources = new Set<AnyNucl>()

  
  const compute = () => {
    
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

  
  compute()

  
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

  
  sources.forEach(source => {
    const originalDecay = source.decay
    source.decay = function() {
      if (!this._decayed) {  
        cleanups.forEach(c => c())
        decayedSources.add(this)  
        result(undefined)  
        this._decayed = true
      }
      return originalDecay.call(this)
    }
  })

  return result
}


export function createEffectWithStrategy(
  sources: AnyNucl[],
  fn: (...values: any[]) => void,
  strategy: Strategy
): () => void {
  
  const runEffect = () => {
    if (strategy(sources)) {
      const values = sources.map(s => s.value)
      fn(...values)
    }
  }

  
  runEffect()

  
  const listeners: Array<{ source: any, listener: any }> = []
  let skipCount = sources.length  

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

  
  return () => {
    listeners.forEach(({ source, listener }) => {
      source.down(listener)
    })
  }
}
