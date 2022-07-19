/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

export const eternalSym = Symbol('eternal')

export function eternal<T>(startValue?: T): T {
  return { sym: eternalSym, startValue } as any as T
}
