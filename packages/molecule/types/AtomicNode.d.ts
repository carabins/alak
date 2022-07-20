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

  emitEvent(name: MoleculeEvents, data?: any)

  onActivate(listiner: (node: AtomicNode<Model, Events>) => void)
}

interface MultiAtomicNode<M, E, N, Events extends readonly string[]> {
  get(id): AtomicInstance<M, E, N, Events>

  delete(id): void

  broadCast: AtomicInstance<M, E, N, Events>['core']
}

type QuantumAtom = {
  id?: any
  target?: any
  eventBus?: INucleon<any>
  // parentBus?: INucleon<any>
  // modelBus?: INucleon<any>
  name?: string
  atom?: AtomicNode<any, any>
  activateListeners: AnyFunction[]
}
