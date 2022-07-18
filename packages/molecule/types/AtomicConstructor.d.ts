/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

type StartupOption = 'LAZY' | 'IMMEDIATELY'

interface AtomicConstructor<Model, E, N, EV extends readonly string[]> {
  name?: string
  model?: Model
  eternal?: E

  edges?: N extends Record<string, AtomicNode<any, any>>
    ? GraphBuilderN<MixClass<Model, E>, N>
    : GraphBuilder<MixClass<Model, E>>
  events?: EV
  listen?: PartialRecord<Uppercase<EV[number]>, keyof Instance<Model>>
  nodes?: N

  startup?: StartupOption

  activate?(
    this: ModelState<Model>,
    core: Atomized<PureModel<Instance<Model>>> & OnlyFunc<Instance<Model>>,
    nodes: N,
  ): void
}
