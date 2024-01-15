/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

export const savedSym = Symbol.for('saved')
export const tagSym = Symbol.for('tag')
export const statelessSym = Symbol.for('stateless')
export const mixedSym = Symbol.for('mixed')

function tagFn(...argArray) {
  const [startValue] = argArray
  return {sym: tagSym, startValue, tag: true}
}

tagFn.paked = true

export const tag = new Proxy(tagFn as any, {
  get(_, tag: string): any {
    const tagFn = (startValue) => {
      return {sym: tagSym, startValue, tag}
    }
    tagFn.paked = true
    return tagFn
  },
}) as {
  <T>(startValue?: T): T
  [s: string]: <T>(startValue?: T) => T
}

export function saved<T>(startValue?: T): T {
  return {sym: savedSym, startValue} as any as T
}

saved.paked = true

export function mixed<T>(...a: any[]): T {
  return {sym: mixedSym, mix: a} as any as T
}

mixed.paked = true

export function stateless<T>(startValue?: T): T {
  return {sym: statelessSym, startValue} as any as T
}

stateless.paked = true
