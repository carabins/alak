import { isDefined } from '@alaq/atom/extra'

export const isString = (p) => typeof p === 'string'

export const cloudProxy = {
  superState(supers, atom) {
    return new Proxy(atom, {
      get(target: any, p: string | symbol, receiver: any): any {
        const superValue = supers[p]
        if (superValue) {
          return superValue
        } else {
          return atom[p]
        }
      },
    })
  },

  warp: (shell, core) =>
    new Proxy(
      { shell, core },
      {
        get(target: any, p: string | symbol, receiver: any): any {
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

  // awakeProxy: (sleepingAtoms) =>
  //   new Proxy(sleepingAtoms, {
  //     get(target: any, p: string | symbol, receiver: any): any {
  //       const atom = target[p]
  //       console.log('awakeProxy', atom, p)
  //       if (atom) {
  //         if (atom.hasMeta('sleep')) {
  //           const wakeup = atom.getMeta('sleep')
  //           wakeup()
  //           atom.removeMeta('sleep')
  //         }
  //         return atom
  //       }
  //       return undefined
  //     },
  //   }),
  // warpState: (atoms, proxyState) =>
  //   new Proxy(
  //     { atoms, proxyState },
  //     {
  //       get(target: any, p: string | symbol, receiver: any): any {
  //         const atom = target.atoms[p]
  //         return atom ? atom.value : target.proxyState[p]
  //       },
  //     },
  //   ),
}
/*
 * Copyright (c) 2022. Only the truth - liberates.
 */
