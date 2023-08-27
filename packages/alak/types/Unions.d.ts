interface UnionCoreService<Models, Events extends object, Factory> {
  readonly atoms: { [K in keyof Models]: AlakAtom<Models[K], Events> }
  bus: IQuarkBus<AlakCoreEvents & Events, Events>
}

type UnionSynthesis<M, E extends object, S, F> = {
  namespace: string
  models: M
  events?: E
  services?: S
  factories?: F
  emitChanges?: boolean
}

type UnionCore<Models, Events extends object, Services, Factory> = {
  // <SN extends keyof Services>(serviceName: SN, value: Services[SN]): void
  bus: IQuarkBus<AlakCoreEvents & Events, Events>
  facade: FacadeModel<Models, Events, Factory> & Services
  services: UnionCoreService<Models, Events, Factory>
}
type IUnionCore = UnionCore<any, any, any, any>

type AtomicModels<Models, E extends object> = {
  [K in keyof Models]: AlakAtom<Models[K], E>
}

type AtomicFactory<F, E> = {
  [K in keyof F]: AlakAtomFactory<F[K], E>
}

type FacadeModel<Models, Events extends object, Factory> = {
  readonly atoms: AtomicModels<Models, Events> & AtomicFactory<Factory, Events>
  readonly nucleons: { [K in keyof Models]: AtomCore<Instance<Models[K]>> }
  readonly states: { [K in keyof Models]: ModelState<Models[K]> }
  readonly buses: { [K in keyof Models]: IQuarkBus<AlakCoreEvents & Events, Events> }
  readonly bus: IQuarkBus<AlakCoreEvents & Events, Events>
}
