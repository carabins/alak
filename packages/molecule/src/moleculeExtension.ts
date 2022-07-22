/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

export default function (q: QuantumAtom) {
  return {
    _: {
      dispatchEvent: q.molecule.eventBus,
      atoms: q.molecule.atoms,
    },
  }
}
