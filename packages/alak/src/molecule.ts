import { alakModel } from 'alak/model'

export function alakMolecule<T extends Record<string, any>>(models: T) {
  const nodes = {} as {
    [K in keyof T as `${Extract<K, string>}Node`]: ANode<T[K]>
  }
  const cores = {} as {
    [K in keyof T as `${Extract<K, string>}Core`]: AtomCore<Instance<T[K]>>
  }
  const states = {} as {
    [K in keyof T as `${Extract<K, string>}State`]: T[K]
  }

  for (const name in models) {
    const an = alakModel({
      name,
      model: models[name],
    })
    nodes[name + 'Node'] = an
    cores[name + 'Core'] = an.core
    states[name + 'State'] = an.state as any
  }
  return Object.assign(nodes, cores, states)
}
