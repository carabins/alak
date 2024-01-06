import {unionAtom, UnionAtomFactory} from "alak/unionAtom";
import {defaultNamespace} from "alak/namespaces";
import {UnionCoreFactory} from "alak/UnionCoreFactory";


type EventRecords = Record<string, (...any) => any>
type EventsData<E extends EventRecords> = {
  [K in keyof E]: Parameters<E[K]>[0]
}

export function UnionFactory<Models, Events extends EventRecords, Services, Factories>(
  synthesis: IUnionSynthesis<Models, Events, Services, Factories>,
): IFacadeModel<Models, EventsData<Events>, Factories> & Services {
  const uc = UnionCoreFactory(synthesis.namespace as any || defaultNamespace) as IUnionDevCore
  synthesis.models && Object.keys(synthesis.models).forEach((modelName) => {
    uc.services.atoms[modelName] = unionAtom({
      namespace: synthesis.namespace,
      name: modelName,
      model: synthesis.models[modelName],
      emitChanges: synthesis.emitChanges,
    })
  })
  synthesis.factories &&
  Object.keys(synthesis.factories).forEach((modelName) => {
    uc.services.atoms[modelName] = UnionAtomFactory({
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
