type RoArrayToRecord<T extends ReadonlyArray<string>> = {
  [K in T extends ReadonlyArray<infer U> ? U : never]: number
}

type FlagGroupKeys<T extends ReadonlyArray<string>> = Record<
  string,
  Array<keyof RoArrayToRecord<T>>
>
type FlagGroup<F extends ReadonlyArray<string>, S, T> = Record<
  keyof RoArrayToRecord<F> | keyof S,
  T
>

// type BitBoolState<T> = {
//   [K in keyof T as `${Capitalize<Extract<K, string>>}`]: boolean
// }

// type StateController<T, A> = {
//   setTrue(...flags: Array<keyof T>): void
//   setFalse(...flags: Array<keyof T>): void
//   toggle(...flags: Array<keyof T>): void
//   when(flag: keyof A, value: boolean, listener: Function): string
//   changes(listener: (key: keyof A, value: boolean) => void): void
// }

type BitWiseOperations<Bits> = {
  and?: Array<Bits>
  not?: Array<Bits>
  or?: Array<Bits>
  // xor?: Array<Bits>
}

type RemoveObject = any

type IBitWise = {
  is(n): boolean
  isNot(n): boolean
  add(n: number): void
  remove(n: number): void
  toggle(n: number): void
  set(n: number): void
  readonly value?: number
  toString?(): string
  onValueUpdate(listener: (n: number) => void): RemoveObject
  removeValueUpdate(ro: RemoveObject): void
}

type BitInstanceConfigWises<B extends ReadonlyArray<string>, S> = Record<
  string,
  BitWiseOperations<keyof RoArrayToRecord<B> | keyof S>
>

type BitInstanceConfig<
  F extends ReadonlyArray<string>,
  G extends FlagGroupKeys<F>,
  C extends BitInstanceConfigWises<F, G>,
> = {
  startValue?: number
  readonly flags: F
  groups?: G
  combinations?: C
  config?: {
    global?: boolean
    stored?: boolean
  }
}

type BiTFlags<Keys, T> = {
  [K in keyof Keys]: T
}

type CoreBitFlag = {
  is(bitValue: number)
  bitValue: number
  toggle(): void
  setTrue(): void
  setFalse(): void
}
type FlagListener = {
  state: boolean
  onValueUpdate(event: 'ANY' | 'TRUE' | 'FALSE', listener: Function): RemoveObject
  removeValueUpdate(ro: RemoveObject): void
}
// type BitFlagMutation = {
// }

interface IBitInstance<F extends ReadonlyArray<string>, G extends FlagGroupKeys<F>, C> {
  state: Record<keyof RoArrayToRecord<F> | keyof G | keyof C, boolean>
  flags: BiTFlags<RoArrayToRecord<F>, CoreBitFlag & FlagListener> &
    BiTFlags<G, CoreBitFlag & FlagListener> &
    BiTFlags<C, FlagListener>
  core: {
    allFlagValues: Record<keyof RoArrayToRecord<F> | keyof G, number>
    baseFlagValues: Record<keyof RoArrayToRecord<F>, number>
  }
  bitwise: IBitWise

  setTrue(...flags: Array<keyof RoArrayToRecord<F>>)

  setFalse(...flags: Array<keyof RoArrayToRecord<F>>)

  onValueUpdate(event: 'AFFECTED_FLAGS' | 'FULL_STATE' | 'BIT_VALUE', listener: Function): Function

  removeValueUpdate(listener: Function | string): void
}
