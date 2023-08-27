interface UnionCoreService<Models, Events> {
  readonly atoms: { [K in keyof Models]: AlakAtom<Models[K]> }
  bus: IQuarkBus<AlakCoreEvents & Events, Events>
}

type UnionSynthesis<M, E, S> = {
  namespace: keyof ActiveUnion
  models: M
  events?: E
  services?: S
}
type UnionCore<Models, Events, Services> = {
  // <SN extends keyof Services>(serviceName: SN, value: Services[SN]): void
  bus: IQuarkBus<AlakCoreEvents & Events, Events>
  facade: FacadeModel<Models, Events> & Services
  services: UnionCoreService<Models, Events>
}

type FacadeModel<Models, Events> = {
  readonly atoms: { [K in keyof Models]: AlakAtom<Models[K]> }
  readonly nucleons: { [K in keyof Models]: AtomCore<Instance<Models[K]>> }
  readonly states: { [K in keyof Models]: ModelState<Models[K]> }
  readonly buses: { [K in keyof Models]: IQuarkBus<AlakCoreEvents & Events, Events> }
  readonly bus: IQuarkBus<AlakCoreEvents & Events, Events>
}
