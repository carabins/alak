/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

export const savedSym = Symbol.for('saved')
export const finiteSym = Symbol.for('finite')
export const tagSym = Symbol.for('tag')
export const statelessSym = Symbol.for('stateless')
export const mixedSym = Symbol.for('mixed')
export const wrapSym = Symbol.for('wrapped')

function tagFn(...argArray) {
  const [startValue] = argArray
  return { sym: tagSym, startValue, tag: true }
}

export const tag = new Proxy(tagFn as any, {
  get(_, tag: string): any {
    const tagFn = (startValue) => {
      return { sym: tagSym, startValue, tag }
    }
    return tagFn
  },
}) as {
  <T>(startValue?: T): T
  [s: string]: <T>(startValue?: T) => T
}

export function saved<T>(startValue?: T): T {
  return { sym: savedSym, startValue } as any as T
}

export function mixed<T>(...a: any[]): T {
  return { sym: mixedSym, mix: a } as any as T
}

export function stateless<T>(startValue?: T): T {
  return { sym: statelessSym, startValue } as any as T
}

export function finite<T>(startValue?: T): T {
  return { sym: finiteSym, startValue } as any as T
}

export function wrap<T, B>(wrapper: (v: T) => B, startValue?: T) {
  return { sym: wrapSym, startValue, wrapper } as any as B
}
