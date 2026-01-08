

import type { INucleonPlugin } from '../INucleonPlugin'
import { strategies, type StrategyName } from './strategies'

type AnyNucl = any


export const fusionPlugin: INucleonPlugin = {
  name: 'fusion',
  symbol: Symbol('fusion'),

  methods: {
    
    fusion(this: any, ...args: any[]) {
      
      const fn = args[args.length - 1]
      const sources = args.slice(0, -1).filter(arg => typeof arg !== 'string')
      const strategyName = args.length > 2 && typeof args[args.length - 2] === 'string'
        ? args[args.length - 2]
        : 'alive' 

      
      const strategy = strategies[strategyName as StrategyName]
      if (!strategy) {
        throw new Error(`Unknown fusion strategy: ${strategyName}`)
      }

      
      const decayedSources = new Set<any>()

      
      const self = this
      const compute = () => {
        
        if (decayedSources.size > 0) {
          self(undefined)
          return
        }

        if (strategy(sources)) {
          const values = sources.map(s => s.value)
          const newValue = fn(...values)
          self(newValue)
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
            self(undefined)  
            this._decayed = true
          }
          return originalSourceDecay.call(this)
        }
      })

      
      self._fusionCleanup = () => {
        cleanups.forEach(c => c())
      }

      return this
    }
  }
}
