/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

type CanBeArray<T> = T | Array<T>
type ActionsAndN<T> = CanBeArray<GetValues<T> | GetActions<T>>

type AtomicInstance<M, E, N> = N extends Record<string, ANode<any>>
  ? MixClass<ANode<M>, GraphSubNodes<N>>
  : ANode<M>

type ModelCore<Model> = Atomized<PureModel<Instance<Model>>> & OnlyFunc<Instance<Model>>
type ModelState<Model> = PureModel<Instance<Model>>

interface ANode<Model> {
  state: ModelState<Model>
  core: ModelCore<Model>
  actions: OnlyFunc<Instance<Model>>
  bus: QuarkBus<any, any>

  // emitEvent(name: ClusterEvents, data?: any)
  onActivate(listiner: (node: ANode<Model>) => void)

  getValues(): ModelState<Model>
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
  bus: QuarkBus<any, any>
  cluster: {
    atoms: any
    bus: QuarkBus<any, any>
  }
  atom?: ANode<any>
  eventListeners?: string[]
}
