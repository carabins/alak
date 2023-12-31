type IUnionSynthesis<M, E extends object, S, F> = {
  namespace?: string
  singletons?: M
  factories?: F
  events?: E
  services?: S
  emitChanges?: boolean
}

interface IUnionCoreService<Models, Events extends object, Factory> {
  readonly atoms: { [K in keyof Models]: IAlakAtom<Models[K], Events> }
  bus: IQuarkBus<IAlakCoreEvents & Events, Events>
}

type IUnionCore<Models, Events extends object, Services, Factory> = {
  bus: IQuarkBus<IAlakCoreEvents & Events, Events>
  facade: IFacadeModel<Models, Events, Factory> & Services
  services: IUnionCoreService<Models, Events, Factory>
}

type IUnionDevCore = IUnionCore<any, any, any, any>

type IAtomicModels<Models, E extends object> = {
  [K in keyof Models]: IAlakAtom<Models[K], E>
}

type IAtomicFactory<F, E> = {
  [K in keyof F]: IAlakAtomFactory<F[K], E>
}

type IFacadeModel<Models, Events extends object, Factory> = {
  readonly atoms: IAtomicModels<Models, Events> & IAtomicFactory<Factory, Events>
  readonly core: { [K in keyof Models]: IAtomCore<Instance<Models[K]>> }
  readonly states: { [K in keyof Models]: IModelState<Models[K]> }
  readonly buses: { [K in keyof Models]: IQuarkBus<IAlakCoreEvents & Events, Events> }
  readonly bus: IQuarkBus<IAlakCoreEvents & Events, Events>
}
