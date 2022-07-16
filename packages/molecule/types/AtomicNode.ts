/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

interface AtomicConstructor<Model, E, N, EV extends readonly string[]> {
  name?: string
  model?: Model
  eternal?: E | keyof PureModel<Model> | Array<keyof PureModel<Model>>

  edges?: N extends Record<string, AtomicNode<any, any>>
    ? GraphBuilderN<Model, N>
    : GraphBuilder<MixClass<Model, E>>
  events?: EV
  listen?: PartialRecord<any, GetActions<Instance<Model>>>
  lifeCycle: {}
  nodes?: N
}

interface AtomicNode<Model, Events extends readonly string[]> {
  state: Model
  core: Atomized<Model>
  actions: OnlyFunc<Instance<Model>>

  emitEvent(name: Uppercase<Events[number]>, data?: any)

  onActivate(listiner: (node: AtomicNode<Model, Events>) => void)
}
