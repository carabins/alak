/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

type CanBeArray<T> = T | Array<T>
type ActionsAndN<T> = CanBeArray<GetValues<T> | GetActions<T>>

type AtomicInstance<M, E, N> = N extends Record<string, AlakAtom<any>>
  ? MixClass<AlakAtom<M>, GraphSubNodes<N>>
  : AlakAtom<M>

type ModelCore<Model> = Atomized<PureModel<Instance<Model>>> & OnlyFunc<Instance<Model>>
type ModelState<Model> = PureModel<Instance<Model>>

interface AlakAtom<Model> {
  state: ModelState<Model>
  core: ModelCore<Model>
  actions: OnlyFunc<Instance<Model>>
  bus: QuarkBus<any, any>

  // emitEvent(name: ClusterEvents, data?: any)
  onActivate(listiner: (node: AlakAtom<Model>) => void)

  getValues(): ModelState<Model>
}

interface MultiAtomicNode<M, E, N> {
  get(id): AtomicInstance<M, E, N>

  delete(id): void

  broadCast: AtomicInstance<M, E, N>['core']
}

type ActiveCluster<Models> = {
  atoms: { [K in keyof Models]: AlakAtom<Models[K]> }
  nucleons: { [K in keyof Models]: AtomCore<Instance<Models[K]>>; };
  states: { [K in keyof Models]: ModelState<Models[K]>; };
  buses: { [K in keyof Models]: QuarkBus<any, any>; };
  bus: QuarkBus<string, any>;
}

type QuantumAtom = {
  id?: any
  name: string
  target?: any
  bus: QuarkBus<any, any>
  cluster: ActiveCluster<any>
  atom?: AlakAtom<any>
  eventListeners?: string[]
}
