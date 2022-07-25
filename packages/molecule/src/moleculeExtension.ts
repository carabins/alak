/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

export default function (q: QuantumAtom) {
  const getA = (name) => {
    const a = q.molecule.atoms[name]
    if (!a) {
      console.error(`обращение из атома [${q.name}] к отсуствующему атому [${name}]`)
    }
    return a
  }
  // const proxy = new Proxy({_}, {})

  const under = {
    id: q.id,
    name: q.name,
    dispatchEvent: q.molecule.eventBus,
    molecule: q.molecule.atoms,
    target: q.target,
    set(atom: string, nuclon: string, data: any) {
      const a = getA(atom)
      a && a.core[nuclon](data)
    },
    get(atom: string, nuclon) {
      const a = getA(atom)
      return a ? a.core[nuclon].value : new Error('atom not found')
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
