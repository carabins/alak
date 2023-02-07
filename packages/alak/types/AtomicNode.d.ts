/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

type CanBeArray<T> = T | Array<T>
type ActionsAndN<T> = CanBeArray<GetValues<T> | GetActions<T>>

type AtomicInstance<M, E, N> = N extends Record<string, AtomicNode<any>>
  ? MixClass<AtomicNode<M>, GraphSubNodes<N>>
  : AtomicNode<M>

type ModelCore<Model> = Atomized<PureModel<Instance<Model>>> & OnlyFunc<Instance<Model>>
type ModelState<Model> = PureModel<Instance<Model>>

interface AtomicNode<Model> {
  state: ModelState<Model>
  core: ModelCore<Model>
  actions: OnlyFunc<Instance<Model>>
  bus: QuarkBus<any, any>

  // emitEvent(name: ClusterEvents, data?: any)
  onActivate(listiner: (node: AtomicNode<Model>) => void)
}

interface MultiAtomicNode<M, E, N> {
  get(id): AtomicInstance<M, E, N>

  delete(id): void

  broadCast: AtomicInstance<M, E, N>['core']
}

type QuantumAtom = {
  id?: any
  name: string
  target?: any
  // eventBus?: INucleon<any>
  // clusterBus: QuarkBus<any, any>
  bus: QuarkBus<any, any>
  cluster: {
    atoms: any
    // eventBus: any
    bus: QuarkBus<any, any>
  }
  atom?: AtomicNode<any>
  eventListeners?: string[]
}
