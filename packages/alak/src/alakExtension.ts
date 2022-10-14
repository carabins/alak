/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

export default function (q: QuantumAtom) {
  const getA = (name) => {
    const a = q.cluster.atoms[name]
    if (!a) {
      console.error(`обращение из атома [${q.name}] к отсуствующему атому [${name}]`)
    }
    return a
  }
  // const proxy = new Proxy({_}, {})

  const under = {
    id: q.id,
    name: q.name,
    dispatchEvent: q.cluster.eventBus,
    cluster: q.cluster.atoms,
    target: q.target,
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
