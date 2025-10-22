import nuclear from '@alaq/atom/nuclear'
const isDefined = (v) => v !== undefined && v !== null

export const isString = (p) => typeof p === 'string'

export const cloudProxy = {
  nuclear: (valence: Record<string, any>, core: IDeepAtomCore<any>) =>
    new Proxy(
      { valence, core },
      {
        get(a, key: string) {
          return a.core.nucleons[key] || nuclear(key, valence, core)
        },
      },
    ),
  warpNucleonGetter: (getter, core) =>
    new Proxy(
      { getter, core },
      {
        get(o, key) {
          const v = o.getter(key)
          return v ? v.value : o.core[key]
        },
        set(o, k, v) {
          o.core[k] = v
          return true
        },
      },
    ),
  warp: (shell, core) =>
    new Proxy(
      { shell, core },
      {
        get(target: any, p: string | symbol): any {
          const s = target.shell[p]
          return isDefined(s) ? s : target.core[p]
        },
        set(target, p, value) {
          target.core[p] = value
          return true
        },
      },
    ),
  state: (atom) =>
    new Proxy(
      { atom },
      {
        get(target: any, p: any): any {
          if (isString(p)) {
            return target.atom[p].value
          }
        },
        set(target: { atom: any }, p: string, value: any): boolean {
          if (isString(p)) {
            target.atom[p](value)
            return true
          }
          return false
        },
      },
    ),
}
/*
 * Copyright (c) 2022. Only the truth - liberates.
 */
