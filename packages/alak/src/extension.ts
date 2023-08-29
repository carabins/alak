/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

export default function (q: QuantumAtom) {
  const getA = (name) => {
    const a = q.union.services.atoms[name]
    if (!a) {
      console.error(`обращение из атома [${q.name}] к отсуствующему атому [${name}]`)
    }
    return a
  }

  const under = {
    id: q.id,
    name: q.name,
    union: q.union.services.atoms,
    target: q.data,
    call(atom: string, methodName: string, args?: any[]) {},
    set(atom: string, nucleon: string, data: any) {
      const a = getA(atom)
      a && a.core[nucleon](data)
    },
    get(atom: string, nucleon) {
      const a = getA(atom)
      return a ? a.core[nucleon].value : new Error('atom not found')
    },
  }
  return {
    _: new Proxy(under, {
      get(t, k) {
        return q.union.facade
      },
    }),
    __: new Proxy(under, {
      get(t, k) {
        if (k === 'core') {
          return q.atom.core
        }
        const v = t[k]
        if (v) {
          return v
        }
        return undefined
      },
    }),
  }
}
