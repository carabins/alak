import A from 'alak/index'
import { isDefined } from './extra'
import { storage } from './storage'

// type KV = {
//   [key: string | number]: any
// }
// type MayBeToKV<T> = T extends unknown ? T : KV

type Atomized<T> = { readonly [K in keyof T]: IAtom<T[K]> }
type Atoms<T> = keyof T
type ModelMolecule<T> = T extends ClassInstance ? ClassToKV<T> : T
type AtomicModel<T> = Atomized<ModelMolecule<T>>

// type Prom<T> = {
//   (...atoms: Atoms<T>[]): Promise<any>
// }

type ClassInstance = new (...args: any) => any
type ClassToKV<T> = T extends ClassInstance ? InstanceType<T> : never

export const eternalMolecule = <T>(domain: string, model: T) =>
  Molecule(model).domain(domain).eternals().one()
export const eternalMolecules = <T>(domain: string, model: T) =>
  Molecule(model).domain(domain).eternals().many()

export const oneMolecule = <T>(model: T) => Molecule(model).one()
export const manyMolecules = <T>(model: T) => Molecule(model).many()

export default function Molecule<T>(model?: T) {
  let memorize
  let domain
  let proxy

  function one(finalDomain?: string) {
    const atoms = {}
    proxy = new Proxy(
      {},
      {
        apply(target: {}, thisArg: any, argArray: any[]): any {
          return atoms
        },
        get(t, key): any {
          let superModel
          if (typeof model === 'function') {
            //@ts-ignore
            superModel = new model()
          } else {
            superModel = model
          }
          return synthAtom(atoms, key, superModel, finalDomain || domain, memorize)
        },
      },
    )
    return proxy as AtomicModel<T>
  }

  function many() {
    const molecules = {} as KV<AtomicModel<T>>

    function make(moleculeId) {
      const m = molecules[moleculeId]
      if (m) {
        return m
      } else {
        return (molecules[moleculeId] = one())
      }
    }

    // function host(moleculeId) {
    //   return make(moleculeId)
    // }

    const cast = new Proxy(
      {},
      {
        get(target: {}, key: string) {
          return (value) => {
            Object.values(molecules).forEach((m) => {
              return m[key](value)
            })
          }
        },
      },
    ) as KV<AtomicModel<T>>

    function decay(moleculeId) {
      const m = molecules[moleculeId] as any
      if (m) {
        Object.values(m()).forEach((atoms) => {
          Object.values(atoms).forEach((a) => {
            a.decay()
          })
        })
      }
    }

    const decayAll = () => {
      Object.keys(molecules).forEach(decay)
    }
    const getKeys = () => Object.keys(molecules)
    return {
      new: make,
      cast,
      decay,
      decayAll,
      getKeys,
    }
  }

  return {
    one,
    many,
    domain(name) {
      domain = name
      return {
        one,
        eternals(...onlyAtoms: Atoms<T>[]) {
          memorize = onlyAtoms.length ? onlyAtoms : true
          return {
            one,
            many,
          }
        },
      }
    },
  }
}

function synthAtom(atoms, key, model, domain, memorize) {
  let atom: IAtom<any> = atoms[key]
  if (!atom) {
    const id = domain ? `${domain}.${key}` : key
    let modelValue = model ? model[key] : undefined,
      mem
    if (typeof memorize === 'boolean') {
      mem = true
    } else {
      mem = memorize && memorize.indexOf(key) !== -1
    }
    atoms[key] = atom = A()
    atom.setId(id)
    if (mem) {
      storage.init(atom)
      atom.isEmpty && isDefined(modelValue) && atom(modelValue)
    } else {
      if (isDefined(modelValue)) {
        atom(modelValue)
      }
    }
  }
  return atom
}
