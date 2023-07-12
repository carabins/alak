import { alakModel } from 'alak/model'
import { injectCluster } from 'alak/index'

export function alakCluster<T extends Record<string, any>>(models: T, name = 'cluster') {
  const atoms = {} as {
    [K in keyof T]: AlakAtom<T[K]>
  }
  const cores = {} as {
    [K in keyof T]: AtomCore<Instance<T[K]>>
  }
  const states = {} as {
    [K in keyof T]: ModelState<T[K]>
  }
  const buses = {} as {
    [K in keyof T]: QuarkBus<any, any>
  }

  for (const name in models) {
    const an = alakModel({
      name,
      model: models[name],
    })
    atoms[name] = an
    cores[name] = an.core
    states[name] = an.state
    buses[name] = an.bus
  }

  return { atoms, cores, states, buses, bus: injectCluster(name).bus }
}
