/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

export const storedSym = Symbol('stored')
export const tracedSym = Symbol('traced')
export const statelessSym = Symbol('stateless')

export const traced = new Proxy(() => true, {
  apply(_, thisArg: any, argArray: any[]): any {
    const [startValue] = argArray
    return { sym: tracedSym, startValue, traced: true }
  },
  get(_, traced: string): any {
    return (startValue) => {
      // target.startValue = startValue
      return { sym: tracedSym, startValue, traced }
    }
  },
}) as {
  <T>(startValue?: T): T
  [s: string]: <T>(startValue?: T) => T
}

export function stored<T>(startValue?: T): T {
  return { sym: storedSym, startValue } as any as T
}

export function stateless<T>(startValue?: T): T {
  return { sym: statelessSym, startValue } as any as T
}
