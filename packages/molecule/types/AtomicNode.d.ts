/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

type CanBeArray<T> = T | Array<T>
type ActionsAndN<T> = CanBeArray<GetValues<T> | GetActions<T>>

type AtomicInstance<M, E, N, Events extends readonly string[]> = N extends Record<
  string,
  AtomicNode<any, Events>
>
  ? MixClass<AtomicNode<MixClass<E, M>, Events>, GraphSubNodes<N>>
  : AtomicNode<MixClass<E, M>, Events>

type ModelCore<Model> = Atomized<PureModel<Instance<Model>>> & OnlyFunc<Instance<Model>>
type ModelState<Model> = PureModel<Instance<Model>>

interface AtomicNode<Model, Events extends readonly string[]> {
  state: ModelState<Model>
  core: ModelCore<Model>
  actions: OnlyFunc<Instance<Model>>

  emitEvent(name: Uppercase<Events[number]>, data?: any)

  onActivate(listiner: (node: AtomicNode<Model, Events>) => void)
}

interface MultiAtomicNode<M, E, N, Events extends readonly string[]> {
  get(id): AtomicInstance<M, E, N, Events>

  delete(id): void

  broadCast: AtomicInstance<M, E, N, Events>['core']
}

interface MultiAtomicConstructor<Model, E, N> {
  name?: string
  model?: Model
  eternal?: E

  edges?: N extends Record<string, AtomicNode<any, any>>
    ? GraphBuilderN<MixClass<Model, E>, N>
    : GraphBuilder<MixClass<Model, E>>
  listen?: PartialRecord<string, keyof Instance<Model>>
  nodes?: N

  activate?(
    this: ModelState<Model>,
    core: Atomized<PureModel<Instance<Model>>> & OnlyFunc<Instance<Model>>,
    nodes: N,
  ): void
}

type QuantumAtom = {
  id?: any
  target?: any
  eventBus?: INucleon<any>
  name?: string
  atom?: AtomicNode<any, any>
  activateListeners: AnyFunction[]
}
