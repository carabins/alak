type DeepFilter<T, Condition> = {
  [Key in keyof T]: T[Key] extends Condition ? Key : never
}
type PreFilter<T, Condition> = DeepFilter<T, Condition>[keyof T]
type PickType<T, Condition> = Pick<T, PreFilter<T, Condition>>
type OnlyFunc<T> = PickType<T, AnyFunction>
type RemoveKeysByType<T, Condition> = Omit<T, PreFilter<T, Condition>>

type Instance<T> = T extends ClassInstance ? ClassToKV<T> : T
type ClassInstance = new (...args: any) => any
type ClassToKV<T> = T extends ClassInstance ? InstanceType<T> : T

type ModelHiddenProps = '_' | '$'
type FilterNotStartingWith<Set, Needle extends string> = Set extends `${Needle}${infer _X}`
  ? never
  : Set
type FilteredKeys<T> = FilterNotStartingWith<keyof T, ModelHiddenProps>
type HideUnderScore<T> = Omit<T, ModelHiddenProps>
// type OnlyPublicKeys<T> = Omit<T, ModelHiddenProps>
type OnlyPublicKeys<T> = Pick<Omit<T, ModelHiddenProps>, FilteredKeys<T>>

// type PureModel<T> = OnlyPublicKeys<RemoveKeysByType<T, AnyFunction>>
type PureState<T> = OnlyPublicKeys<RemoveKeysByType<T, AnyFunction>>
type PureModel<T> = OnlyPublicKeys<T>
type Atomized<T> = { readonly [K in keyof T]: INucleus<T[K]> }

type GetValues<T> = keyof RemoveKeysByType<T, AnyFunction>
type GetActions<T> = keyof OnlyFunc<T>

type IAtomCore<Model> = Atomized<PureModel<Model>> & OnlyFunc<Model>
// type AtomState<Model> = PureModel<Model> & OnlyFunc<Model>

type NucleusStrategy = 'core' | 'saved' | 'holistic' | 'stateless' | 'holystate'

type ExternalEvents = 'init' | 'decay'
type ExternalEventData = {}

interface IAtomKnown<T> {
  keys: Set<string>
  actions: Set<string>

  values(): PureModel<Instance<T>>

  meta?: any
}

interface IAtom<T> {
  state: PureState<Instance<T>>
  actions: OnlyFunc<Instance<T>>
  core: IAtomCore<Instance<T>>
  bus: IQuarkBus<any, any>
  known: IAtomKnown<T>
  decay(): void
}

type IAtomOptions<Model> = {
  name?: string
  model?: Model
  saved?: Array<keyof PureModel<Model>> | '*' | boolean
  emitChanges?: boolean
  nucleusStrategy?: NucleusStrategy
  thisExtension?: any
  constructorArgs?: any[]
  bus?: IQuarkBus<any, any>
}
type IDeepAtomCore<T> = IAtomOptions<T> & {
  proxy?: any
  nucleons?: Record<string, INucleus<any>>
  quarkBus: IQuarkBus<any, any>
}
