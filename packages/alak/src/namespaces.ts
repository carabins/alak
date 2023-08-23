import {alakModel} from 'alak/model'
import {QuarkEventBus} from 'alak/index'
import isBrowser from 'packages/rune/src/isBrowser'


// export class ActiveCluster {
//   atoms = {} as Record<string, AlakAtom<any>>
//   bus: QuarkBus<string, any>
//   public constructor(public namespace: string) {
//     this.bus = QuarkEventBus(namespace)
//   }
// }


const defaultNamespace = "ActiveUnion"
const AlakUnion = {
    namespaces: {}
}

function getBrowserNs() {
    if (window['AlakUnionNamespace']) {
        return AlakUnion.namespaces = window['AlakUnionNamespace']
    }
    return window['AlakUnionNamespace'] = AlakUnion.namespaces
}

const getNamespaces = () => (isBrowser ? getBrowserNs() : AlakUnion.namespaces) as UnionNamespaces

type UnionNamespaces = Record<string, UnionCore>

const atomLinked = {
  buses:true,
  cores:true,
  states:true
}
const facadeHandlers = {
  get(target: UnionCoreService, key): any {
    if (atomLinked[key]){
      return target.atoms[key]
    }
    return target[key]
  }
}
export function UnionCore<Models>(namespace: string = defaultNamespace): UnionCore {
  const namespaces = getNamespaces()
  if (namespaces[namespace]) {
    return namespaces[namespace]
  }
  const bus = QuarkEventBus(namespace)
  const services = {
    atoms: {},
    bus
  }
  const facade = new Proxy(services, facadeHandlers) as UnionFacade<Models>
  return namespaces[namespace] = {
    services, facade, bus
  }
}

// function registerUnionFacade<Models>(namespace: string, models?: Models) {
//   return facade
// }

export function registerUnionAtom(namespace: string, name: string, value: any) {
  // const namespaces = getNamespaces()
  // !namespaces[namespace] && registerUnionFacade(namespace)
  // const unionCore = namespaces[namespace]
  // unionCore.services.atoms[name] = value
}

export function registerUnionService(namespace: string, name: string, value: any) {
  // const namespaces = getNamespaces()
  // !namespaces[namespace] && registerUnionFacade(namespace)
  // const unionCore = namespaces[namespace]
  // unionCore.services[name] = value
}




export function UnionFacade<N extends keyof UnionFacades>(namespace?: N): UnionFacades[N] {
  if (!namespace) {
    namespace = defaultNamespace as any
  }
  const namespaces = getNamespaces()
  !namespaces[namespace] && UnionCore(namespace)
  return namespaces[namespace].facade
}


//
//
// export function addModelsToCluster<T extends Record<string, any>>(models: T, clusterName = 'ActiveCluster') {
//   const atoms = {} as {
//     [K in keyof T]: AlakAtom<T[K]>
//   }
//   const cores = {} as {
//     [K in keyof T]: AtomCore<Instance<T[K]>>
//   }
//   const states = {} as {
//     [K in keyof T]: ModelState<T[K]>
//   }
//   const buses = {} as {
//     [K in keyof T]: QuarkBus<any, any>
//   }
//
//   for (const name in models) {
//     const an = alakModel({
//       name,
//       model: models[name],
//     })
//     atoms[name] = an
//     cores[name] = an.core
//     states[name] = an.state
//     buses[name] = an.bus
//   }
//
//   const ic = initiateUnion(name as any)
//   return {atoms, nucleons: cores, states, buses, bus: ic.bus} as UnionFacade<T>
// }

