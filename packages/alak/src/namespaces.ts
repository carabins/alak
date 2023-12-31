// import { alakFactory, alakModel, QuarkEventBus } from 'alak/index'
import isBrowser from '@alaq/rune/isBrowser'
import {alakFactory, alakModel} from "alak/model";
import {QuarkEventBus} from "@alaq/nucleus/bus";

const defaultNamespace = 'defaultUnion'
const AlakUnionNamespace = 'AlakUnionNamespace'
const AlakUnion = {
  namespaces: {},
}

function getBrowserNs() {
  if (globalThis[AlakUnionNamespace]) {
    return (AlakUnion.namespaces = globalThis[AlakUnionNamespace])
  }
  return (globalThis[AlakUnionNamespace] = AlakUnion.namespaces)
}


const getNamespaces = () => (isBrowser ? getBrowserNs() : AlakUnion.namespaces) as UnionNamespaces





const atomLinked = {
  buses: 'bus',
  cores: 'core',
  actions: 'action',
  states: 'state',
}
const likedProxy = {}
const likedProxyHandler = {
  get(o, key) {
    return o.atoms[key][o.key]
  },
}
const facadeHandlers = {
  get(target: IUnionCoreService<any, any, any>, key): any {
    if (atomLinked[key]) {
      if (!likedProxy[key]) {
        likedProxy[key] = new Proxy(
          { atoms: target.atoms, key: atomLinked[key] },
          likedProxyHandler,
        )
      }
      return likedProxy[key]
    }
    return target[key]
  },
}
type EventRecords = Record<string, (...any)=>any>
type EventsData<E extends EventRecords> = {
  [K in keyof E]: Parameters<E[K]>[0]
}

export function UnionFactory<Models, Events extends EventRecords, Services, Factories>(
  synthesis: IUnionSynthesis<Models, Events, Services, Factories>,
): IFacadeModel<Models, EventsData<Events>, Factories> & Services {
  const uc = UnionCoreFactory(synthesis.namespace as any || defaultNamespace) as IUnionDevCore
  synthesis.singletons && Object.keys(synthesis.singletons).forEach((modelName) => {
    uc.services.atoms[modelName] = alakModel({
      namespace: synthesis.namespace,
      name: modelName,
      model: synthesis.singletons[modelName],
      emitChanges: synthesis.emitChanges,
    })
  })
  synthesis.factories &&
    Object.keys(synthesis.factories).forEach((modelName) => {
      uc.services.atoms[modelName] = alakFactory({
        namespace: synthesis.namespace,
        name: modelName,
        model: synthesis.factories[modelName],
        emitChanges: synthesis.emitChanges,
      }) as any
    })
  synthesis.events &&
    Object.keys(synthesis.events).forEach((eventName) => {
      const handler = synthesis.events[eventName].bind(uc)
      uc.bus.addEventListener(eventName, handler)
    })
  synthesis.services && Object.assign(uc.services, synthesis.services)
  return uc.facade
}

export function UnionCoreFactory<N extends keyof UnionNamespaces>(
  namespace: N,
): UnionNamespaces[N] {
  //@ts-ignore
  namespace = namespace || defaultNamespace
  const namespaces = getNamespaces()

  if (namespaces[namespace]) {
    return namespaces[namespace]
  }
  const bus = QuarkEventBus(namespace)
  const services = {
    atoms: {},
    bus,
  }
  const uc = {
    services,
    facade: new Proxy(services, facadeHandlers),
    bus,
  } as any
  namespaces[namespace] = uc
  return namespaces[namespace]
}

export interface ActiveUnions {
  defaultUnion: IUnionDevCore
}

type DefaultUnions = {
  defaultUnion: IUnionDevCore
}

export type UnionNamespaces = DefaultUnions & ActiveUnions

export function UnionFacade<N extends keyof UnionNamespaces>(namespace?: N): UnionNamespaces[N] {
  if (!namespace) {
    namespace = defaultNamespace as any
  }
  const namespaces = getNamespaces()
  if (!namespaces[namespace]) {
    console.error('namespace', namespace, 'not found')
    throw 'unknown namespace'
  }
  return namespaces[namespace]
}
