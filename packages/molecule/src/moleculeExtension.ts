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
  return {
    _: {
      dispatchEvent: q.molecule.eventBus,
      atoms: q.molecule.atoms,
      set(atom: string, nuclon: string, data: any) {
        const a = getA(atom)
        a && a.core[nuclon](data)
      },
      get(atom: string, nuclon) {
        const a = getA(atom)
        return a ? a.core[nuclon].value : new Error('atom not found')
      },
    },
  }
}
