// import {installNucleonExtension} from "@alaq/nucleus/create";
import { storage } from './storage'
import { isDefined } from './extra'
import N from '@alaq/nucleus/index'

const space = {
  N,
  plugins: [],
  stabilized: 0,
} as any

export function setupNucleonForAtoms(n: INucleonConstructor<any>) {
  space.N = n
}

export default function create<T>(model?: T) {
  let memorize
  let name
  let proxy

  if (space.plugins.length !== space.stabilized) {
    // space.plugins.forEach(installNucleonExtension)
    space.plugins.length = space.stabilized
  }

  function one(secondName?: string, extendObject?: Record<string, INucleon<any>>) {
    const nucleons = extendObject ? extendObject : {}
    let superModel
    if (typeof model === 'function') {
      //@ts-ignore
      superModel = new model()
    } else {
      superModel = model
    }
    proxy = new Proxy(
      {},
      {
        apply(target: {}, thisArg: any, argArray: any[]): any {
          return nucleons
        },
        get(t, key): any {
          return synthNucleon(nucleons, key, superModel, secondName || name, memorize)
        },
      },
    )
    return proxy as PureAtom<T>
  }

  function many() {
    const atoms = {} as Record<string, PureAtom<T>>

    function make(atomId) {
      const m = atoms[atomId]
      if (m) {
        return m
      } else {
        return (atoms[atomId] = one())
      }
    }

    const cast = new Proxy(
      {},
      {
        get(target: {}, key: string) {
          return (value) => {
            Object.values(atoms).forEach((m) => {
              return m[key](value)
            })
          }
        },
      },
    ) as Record<string, PureAtom<T>>

    function decay(atomId) {
      const m = atoms[atomId] as any
      if (m) {
        Object.values(m()).forEach((nucleons) => {
          Object.values(nucleons).forEach((a) => {
            a.decay()
          })
        })
      }
    }

    const decayAll = () => {
      Object.keys(atoms).forEach(decay)
    }
    const getKeys = () => Object.keys(atoms)
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
    name(lastName) {
      name = lastName
      return {
        one,
        many,
        eternals(...onlyNucleons: PureAtom<T>[]) {
          memorize = onlyNucleons.length ? onlyNucleons : true
          return {
            one,
            many,
          }
        },
      }
    },
  }
}

function synthNucleon(nucleons, key, model, name, memorize) {
  let nucleon: INucleon<any> = nucleons[key]
  if (!nucleon) {
    const id = name ? `${name}.${key}` : key
    let modelValue = model ? model[key] : undefined,
      mem
    if (typeof memorize === 'boolean') {
      mem = true
    } else {
      mem = memorize && memorize.indexOf(key) !== -1
    }
    nucleons[key] = nucleon = space.N()
    nucleon.setId(id)
    if (mem) {
      storage.init(nucleon)
      nucleon.isEmpty && isDefined(modelValue) && nucleon(modelValue)
    } else {
      if (isDefined(modelValue)) {
        nucleon(modelValue)
      }
    }
  }
  return nucleon
}
