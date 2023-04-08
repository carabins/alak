/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

type StartupStrategy = 'lazy' | 'immediately'

interface AtomicConstructor<Model, E, N> {
  name?: string
  model?: Model
  nucleusStrategy?: NucleusStrategy

  emitChanges?: boolean
  startup?: StartupStrategy

  // dispatchEachValues?: boolean

  edges?: N extends Record<string, AtomicNode<any>>
    ? GraphBuilderN<Instance<Model>, N>
    : GraphBuilder<Instance<Model>>
  listen?: PartialRecord<ClusterEvents, keyof Instance<Model>>
  nodes?: N

  activate?(
    this: ModelState<Model>,
    core: Atomized<PureModel<Instance<Model>>> & OnlyFunc<Instance<Model>>,
    nodes: N,
  ): void
}
