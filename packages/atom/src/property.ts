/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

export const eternalSym = Symbol('eternal')
export const flightySym = Symbol('flighty')

export function eternal<T>(startValue?: T): T {
  return { sym: eternalSym, startValue } as any as T
}

export function flighty<T>(startValue?: T): T {
  return { sym: flightySym, startValue } as any as T
}