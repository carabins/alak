/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

export const savedSym = Symbol('saved')
export const runeSym = Symbol('rune')
export const statelessSym = Symbol('stateless')
export const mixedSum = Symbol('mixed')

export const rune = new Proxy(() => true, {
  apply(_, thisArg: any, argArray: any[]): any {
    const [startValue] = argArray
    return { sym: runeSym, startValue, rune: true }
  },
  get(_, rune: string): any {
    return (startValue) => {
      // target.startValue = startValue
      return { sym: runeSym, startValue, rune }
    }
  },
}) as {
  <T>(startValue?: T): T
  [s: string]: <T>(startValue?: T) => T
}

export function saved<T>(startValue?: T): T {
  return { sym: savedSym, startValue } as any as T
}

export function mixed<T>(...a:any[]): T {
  return { sym: mixedSum, mix:a } as any as T
}

export function stateless<T>(startValue?: T): T {
  return { sym: statelessSym, startValue } as any as T
}
