

type AnyNucl = any


export type Strategy = (sources: AnyNucl[]) => boolean


export const strategies = {
  
  alive: (sources: AnyNucl[]) => {
    return sources.every(s => !!s.value)
  },

  
  any: (_sources: AnyNucl[]) => {
    return true
  }
} as const

export type StrategyName = keyof typeof strategies
