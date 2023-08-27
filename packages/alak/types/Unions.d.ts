interface UnionCoreService<Models, Events, Factory> {
  readonly atoms: { [K in keyof Models]: AlakAtom<Models[K]> }
  bus: IQuarkBus<AlakCoreEvents & Events, Events>
}

type UnionSynthesis<M, E, S, F> = {
  namespace: string
  models: M
  events?: E
  services?: S
  factories?: F
}

type UnionCore<Models, Events, Services, Factory> = {
  // <SN extends keyof Services>(serviceName: SN, value: Services[SN]): void
  bus: IQuarkBus<AlakCoreEvents & Events, Events>
  facade: FacadeModel<Models, Events, Factory> & Services
  services: UnionCoreService<Models, Events>
}
type IUnionCore = UnionCore<any, any, any, any>

type AtomicModels<Models> = {
  [K in keyof Models]: AlakAtom<Models[K]>
}

type AtomicFactory<F> = {
  [K in keyof F]: AlakAtomFactory<F[K]>
}

type FacadeModel<Models, Events, Factory> = {
  readonly atoms: AtomicModels<Models> & AtomicFactory<Factory>
  readonly nucleons: { [K in keyof Models]: AtomCore<Instance<Models[K]>> }
  readonly states: { [K in keyof Models]: ModelState<Models[K]> }
  readonly buses: { [K in keyof Models]: IQuarkBus<AlakCoreEvents & Events, Events> }
  readonly bus: IQuarkBus<AlakCoreEvents & Events, Events>
}
