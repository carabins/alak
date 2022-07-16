/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import { Atom } from '@alaq/atom/index'

export default function atomicNode<M, E, N, Events extends readonly string[]>(
  constructor: AtomicConstructor<M, E, N, Events>,
) {
  const newAtom = (constructor) => {
    const { model, eternal, name } = constructor
    return Atom({
      model,
      eternal,
      name,
    })
  }

  const atom = newAtom(constructor)
  const nodes = {}
  constructor.nodes &&
    Object.keys(constructor.nodes).forEach((key) => {
      nodes[key] = newAtom(constructor.nodes[key])
    })

  const an = { nodes }

  return Object.assign(an, atom) as N extends Record<string, AtomicNode<any, Events>>
    ? MixClass<AtomicNode<MixClass<E, M>, Events>, GraphSubNodes<N>>
    : AtomicNode<MixClass<E, M>, Events>
}
