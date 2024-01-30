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

  const facadeProxy = new Proxy(q.union.facade, {
    get(p, key, caller) {
      return p[key]
    },
  })

  const under = {
    _: facadeProxy,
    _modelNamespace: q,
    _modelName: q.name,
    _modelId: q.id,
    _modelData: q.data,
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
  return new Proxy(under, {
    get(u, key) {
      if (key === '$') return q.atom.core
      return u[key]
    },
  })
}
