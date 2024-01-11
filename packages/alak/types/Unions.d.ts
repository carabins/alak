type IUnionSynthesis<M, F, S, E extends object, > = {
  namespace?: string
  models?: M
  factories?: F
  events?: E
  services?: S
  emitChanges?: boolean
}

interface IUnionCoreService<Models, Factory, Events extends object,> {
  readonly atoms: { [K in keyof Models]: IUnionAtom<Models[K], Events> }
  readonly bus: IQuarkBus<IAlakCoreEvents & Events, Events>
}

type IUnionCore<Models, Factory, Services, Events extends object> = {
  readonly bus: IQuarkBus<IAlakCoreEvents & Events, Events>
  readonly facade: IUnionFacade<Models, Factory, Events> & Services
  readonly services: IUnionCoreService<Models, Factory, Events>
}


// type IUnionDevCore = IUnionCore<any, any, any, any>

type IAtomicModels<Models, E extends object> = {
  [K in keyof Models]: IUnionAtom<Models[K], E>
}

type IAtomicFactory<F, E> = {
  [K in keyof F]: IAlakAtomFactory<F[K], E>
}

type IUnionFacade<Models, Factory, Events extends object> = {
  readonly atoms: IAtomicModels<Models, Events> & IAtomicFactory<Factory, Events>
  readonly cores: { [K in keyof Models]: IAtomCore<Instance<Models[K]>> }
  readonly states: { [K in keyof Models]: IModelState<Models[K]> }
  readonly buses: { [K in keyof Models]: IQuarkBus<IAlakCoreEvents & Events, Events> }
  readonly bus: IQuarkBus<IAlakCoreEvents & Events, Events>
}
