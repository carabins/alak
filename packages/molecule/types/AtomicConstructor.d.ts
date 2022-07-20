/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

type StartupStrategy = 'LAZY' | 'IMMEDIATELY'

interface AtomicConstructor<Model, E, N> {
  name?: string
  model?: Model
  nucleusStrategy?: NucleusStrategy
  startup?: StartupStrategy

  edges?: N extends Record<string, AtomicNode<any, any>>
    ? GraphBuilderN<Instance<Model>, N>
    : GraphBuilder<Instance<Model>>
  listen?: PartialRecord<MoleculeEvents, keyof Instance<Model>>
  nodes?: N

  activate?(
    this: ModelState<Model>,
    core: Atomized<PureModel<Instance<Model>>> & OnlyFunc<Instance<Model>>,
    nodes: N,
  ): void
}
