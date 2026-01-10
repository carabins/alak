import cloudCreate from './cloud.create'

export * from './property'
export * from './storage'

export const savedAtom = <T>(name: string, model: T) =>
  Atom({
    model,
    name,
    saved: true,
  })

export const coreAtom = <T>(model: T) =>
  new Proxy(Atom({ model }), {
    get(a, k) {
      return a.core[k]
    },
  }) as any as IAtomCore<ClassToKV<T>>

export const Atom = cloudCreate

export const A = cloudCreate

export class MultiAtomic {
  id: string | any
}
