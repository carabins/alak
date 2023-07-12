type BitKeysFromList<T extends ReadonlyArray<string>> = {
  [K in T extends ReadonlyArray<infer U> ? U : never]: number
}

type GroupedBitKeys<T extends ReadonlyArray<string>> = Record<
  string,
  Array<keyof BitKeysFromList<T>>
>

type BitBoolState<T> = {
  [K in keyof T as `${Capitalize<Extract<K, string>>}`]: boolean
}

type StateController<T, A> = {
  setTrue(...flags: Array<keyof T>): void
  setFalse(...flags: Array<keyof T>): void
  toggle(...flags: Array<keyof T>): void
  changes(listener: (key: keyof A, value: boolean) => void): void
}
type Bitmask<T extends ReadonlyArray<string>, G extends GroupedBitKeys<T>> = {
  masks: BitKeysFromList<T>
  groups: Record<keyof G, number>
  all: BitKeysFromList<T> & Record<keyof G, number>
  stateBuilder(startValue?: number): StateController<T, G>
}
