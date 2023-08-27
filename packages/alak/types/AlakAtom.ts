/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

type CanBeArray<T> = T | Array<T>
type ActionsAndN<T> = CanBeArray<GetValues<T> | GetActions<T>>

// type AtomicInstance<M, E, N> = N extends Record<string, AlakAtom<any>>
//   ? MixClass<AlakAtom<M>, GraphSubNodes<N>>
//   : AlakAtom<M>

type ModelCore<Model> = Atomized<PureModel<Instance<Model>>> & OnlyFunc<Instance<Model>>
type ModelState<Model> = PureModel<Instance<Model>>
type AtomNucleusInitEventData = {
  traced?: any
  n: INucleus<any>
}

type AtomNucleusChangeEventData = {
  value: any
  key: string
  atomId: string
  n: INucleus<any>
}

type AtomLifeCycleEventData = {
  name: string
  atom: AlakAtom<any>
}

type AlakCoreEvents = {
  ATOM_DECAY: AtomLifeCycleEventData
  ATOM_INIT: AtomLifeCycleEventData
  NUCLEUS_CHANGE: AtomNucleusChangeEventData
  NUCLEUS_INIT: AtomNucleusInitEventData
}
type AlakEventsData = AlakCoreEvents & AlakSynthesisEvents

type AtomicEventBus = IQuarkBus<AlakEventsData, AlakSynthesisEvents>

interface AlakAtom<Model> {
  state: ModelState<Model>
  core: ModelCore<Model>
  actions: OnlyFunc<Instance<Model>>
  bus: AtomicEventBus

  onActivate(listiner: (node: AlakAtom<Model>) => void)

  getValues(): ModelState<Model>
}

// interface MultiAtomicNode<M, E, N> {
//   get(id): AtomicInstance<M, E, N>
//
//   delete(id): void
//
//   broadCast: AtomicInstance<M, E, N>['core']
// }

type QuantumAtom = {
  id?: any
  name: string
  target?: any
  bus: QuarkBus<any, any>
  union: UnionCore<any, any, any>
  atom?: AlakAtom<any>
  eventListeners?: string[]
}

type AlakAtomFactory<M> = {
  get(id: string, target: any): AlakAtom<M>
  delete(id: string): void
  multiCore: ModelCore<M>
  bus: QuarkBus<string, any>
}
