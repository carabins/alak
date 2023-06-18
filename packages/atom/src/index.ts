import cloudCreate from './cloud.create'

export const storedAtom = <T>(name: string, model: T) =>
  Atom({
    model,
    name,
    stored: true,
  })

export const coreAtom = <T>(model: T) =>
  new Proxy(Atom({ model }), {
    get(a, k) {
      return a.core[k]
    },
  }) as any as AtomCore<ClassToKV<T>>

export const Atom = cloudCreate

export const A = cloudCreate

export class MultiAtomic {
  id: string | any
}
