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

type PureAtom<T> = Atomized<PureModel<T>>

type GetValues<T> = keyof RemoveKeysByType<T, AnyFunction>
type GetActions<T> = keyof OnlyFunc<T>

interface IAtom<T> {
  state: PureModel<Instance<T>>
  actions: OnlyFunc<Instance<T>>
  core: Atomized<Instance<T>>
}
