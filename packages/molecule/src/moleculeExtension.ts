/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

export default function (q: QuantumAtom) {
  return new Proxy(q, {
    get(q, mayBeQ): any {
      // console.log({ mayBeQ })
      return undefined
    },
  })
}
