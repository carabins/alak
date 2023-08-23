import {alakModel} from 'alak/model'
import {QuarkEventBus} from 'alak/index'
import isBrowser from 'packages/rune/src/isBrowser'
import {Type} from "typedoc";

// export class ActiveCluster {
//   atoms = {} as Record<string, AlakAtom<any>>
//   bus: QuarkBus<string, any>
//   public constructor(public namespace: string) {
//     this.bus = QuarkEventBus(namespace)
//   }
// }

export interface IAlakCluster {

}





export type Clusters = {
  ActiveCluster: ActiveCluster<any>
}

const TSup = {
  activeClusters: {} as Record<string, any>
}

function getBrowserClusters() {
  if (window['activeClusters']) {
    return TSup.activeClusters = window['activeClusters']
  }
  return window['activeClusters'] = TSup.activeClusters
}

const getClusters = () => isBrowser ? getBrowserClusters() : TSup.activeClusters


export function injectCluster<N extends keyof Clusters>(name?: N) : Clusters[N] {
  if (!name){
    name = "ActiveCluster" as any
  }
  const clusters = getClusters()
  if (clusters[name]) {
    return clusters[name]
  } else {
    console.error(name, "is not active cluster")
    throw "CLUSTER_NOT_ACTIVE"
  }
}

/


export function addModelsToCluster<T extends Record<string, any>>(models: T, clusterName = 'ActiveCluster') {
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

  const ic = injectCluster(name as any)
  return {atoms, nucleons:cores, states, buses, bus: ic.bus} as ActiveCluster<T> & IAlakCluster
}

