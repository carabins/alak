type CanBeArray<T> = T | Array<T>
type ActionsAndN<T> = CanBeArray<GetValues<T> | GetActions<T>>

type IModelCore<Model> = Atomized<PureModel<Instance<Model>>> & OnlyFunc<Instance<Model>>
type IModelState<Model> = PureModel<Instance<Model>>
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
  atom: IAlakAtom<any, any>
}

type IAlakCoreEvents = {
  ATOM_DECAY: IAtomLifeCycleEventData
  ATOM_INIT: IAtomLifeCycleEventData
  NUCLEUS_CHANGE: INucleusChangeEventData
  NUCLEUS_INIT: INucleusInitEventData
}

interface IAlakAtom<Model, Events extends object> {
  state: IModelState<Model>
  core: IModelCore<Model>
  actions: OnlyFunc<Instance<Model>>
  bus: IQuarkBus<IAlakCoreEvents & Events, Events>

  onActivate(listiner: (node: IAlakAtom<Model, Events>) => void)

  getValues(): IModelState<Model>

  free(): void
}

type QuantumAtom = {
  id?: any
  name: string
  data?: any
  bus: QuarkBus<any, any>
  union: IUnionDevCore
  atom?: IAlakAtom<any, any>
  eventListeners?: string[]
}

type IAlakAtomFactory<M, E extends Object> = {
  get(id: string | number, target?: any): IAlakAtom<M, E>
  delete(id: string | number): void
  multiCore: IModelCore<M>
  bus: IQuarkBus<IAlakCoreEvents & E, E>
}
