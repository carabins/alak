import { unionAtom, UnionAtomFactory } from 'alak/unionAtom'
import { defaultNamespace } from 'alak/namespaces'
import { GetUnionCore } from 'alak/UnionCore'

type EventRecords = Record<string, (...any) => any>
type EventsData<E extends EventRecords> = {
  [K in keyof E]: Parameters<E[K]>[0]
}

export function UnionConstructor<Models, Factory, Services, Events extends EventRecords>(
  synthesis: IUnionSynthesis<Models, Factory, Services, Events>,
) {
  const uc = GetUnionCore((synthesis.namespace as any) || defaultNamespace)
  const addAtom = (modelName: string, a: IUnionAtom<any, any> | IAlakAtomFactory<any, any>) => {
    uc.services.atoms[modelName] = a as any
  }
  synthesis.models &&
    Object.keys(synthesis.models).forEach((modelName) => {
      addAtom(
        modelName,
        unionAtom({
          namespace: synthesis.namespace,
          name: modelName,
          model: synthesis.models[modelName],
          emitChanges: synthesis.emitChanges,
        }),
      )
    })
  synthesis.factories &&
    Object.keys(synthesis.factories).forEach((modelName) => {
      addAtom(
        modelName,
        UnionAtomFactory({
          namespace: synthesis.namespace,
          name: modelName,
          model: synthesis.factories[modelName],
          emitChanges: synthesis.emitChanges,
        }),
      )
    })
  synthesis.events &&
    Object.keys(synthesis.events).forEach((eventName) => {
      const handler = synthesis.events[eventName].bind(uc.facade)
      uc.bus.addEventListener(eventName, handler)
    })
  synthesis.services &&
    Object.keys(synthesis.services).forEach((serviceName) => {
      uc.services[serviceName] = synthesis.services[serviceName]
    })
  return uc as IUnionCore<Models, Factory, Services, EventsData<Events>>
}
