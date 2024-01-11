type CanBeArray<T> = T | Array<T>
type ActionsAndN<T> = CanBeArray<GetValues<T> | GetActions<T>>

type IModelCore<Model> = Atomized<PureState<Instance<Model>>> & OnlyFunc<Instance<Model>>
type IModelState<Model> = PureState<Instance<Model>>
type INucleusInitEventData = {
  rune?: any
  nucleus: INucleus<any>
}

type INucleusChangeEventData = {
  value: any
  key: string
  atomId: string
  nucleus: INucleus<any>
}

type IAtomLifeCycleEventData = {
  name: string
  atom: IUnionAtom<any, any>
}

type IAlakCoreEvents = {
  UNION_ATOM_DECAY: IAtomLifeCycleEventData
  ATOM_INIT: IAtomLifeCycleEventData
  NUCLEUS_CHANGE: INucleusChangeEventData
  NUCLEUS_INIT: INucleusInitEventData
}

interface IUnionAtom<Model, Events extends object> {
  readonly state: IModelState<Model>
  readonly core: IModelCore<Model>
  readonly actions: OnlyPublicKeys<OnlyFunc<Instance<Model>>>
  readonly bus: IQuarkBus<IAlakCoreEvents & Events, Events>
  readonly known: IAtomKnown<Model>

  decay(): void
}

type QuantumAtom = {
  id?: any
  name: string
  data?: any
  bus?: IQuarkBus<any, any>
  union: IUnionCore<any, any, any, any>
  atom?: IAtom<any>
  eventListeners?: string[]
}

type IAlakAtomFactory<M, E extends Object> = {
  get(id: string | number, target?: any): IUnionAtom<M, E>
  delete(id: string | number): void
  readonly broadcast: IModelCore<M>
  readonly bus: IQuarkBus<IAlakCoreEvents & E, E>
}
