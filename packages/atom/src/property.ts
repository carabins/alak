/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

export const eternalSym = Symbol('eternal')
export const externalSym = Symbol('external')
export const flightySym = Symbol('flighty')

export const external = new Proxy(() => true, {
  apply(target: any, thisArg: any, argArray: any[]): any {
    const [startValue] = argArray
    return { sym: externalSym, startValue, external: true }
  },
  get(target, external: string): any {
    return (startValue) => {
      target.startValue = startValue
      return { sym: externalSym, startValue, external }
    }
  },
}) as {
  <T>(startValue?: T): T
  [s: string]: <T>(startValue?: T) => T
}

export function eternal<T>(startValue?: T): T {
  return { sym: eternalSym, startValue } as any as T
}

export function flighty<T>(startValue?: T): T {
  return { sym: flightySym, startValue } as any as T
}
