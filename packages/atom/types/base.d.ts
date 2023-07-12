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

type PureModel<T> = RemoveKeysByType<T, AnyFunction>
type Atomized<T> = { readonly [K in keyof T]: INucleon<T[K]> }

type GetValues<T> = keyof RemoveKeysByType<T, AnyFunction>
type GetActions<T> = keyof OnlyFunc<T>

type AtomCore<Model> = Atomized<PureModel<Model>> & OnlyFunc<Model>
type AtomState<Model> = PureModel<Model> & OnlyFunc<Model>

type NucleusStrategy = 'core' | 'saved' | 'holistic' | 'stateless' | 'holystate'

type ExternalEvents = 'init' | 'decay'
type ExternalEventData = {}

interface IAtom<T> {
  state: AtomState<Instance<T>>
  actions: OnlyFunc<Instance<T>>
  core: AtomCore<Instance<T>>
  bus: QuarkBus<string, any>

  getValues(): PureModel<Instance<T>>
}

type AtomOptions<Model> = {
  name?: string
  model?: Model
  saved?: Array<keyof PureModel<Model>> | '*' | boolean
  emitChanges?: boolean
  nucleusStrategy?: NucleusStrategy
  thisExtension?: any
  constructorArgs?: any[]
  bus?: QuarkBus<any, any>
}
type DeepAtomCore<T> = AtomOptions<T> & {
  proxy?: any
  nucleons?: Record<string, INucleon<any>>
  quarkBus: QuarkBus<any, any>
}
