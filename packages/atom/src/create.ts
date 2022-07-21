// import {installNucleonExtension} from "@alaq/nucleus/create";
import { storage } from './storage'
import { isDefined } from './extra'
import N from '@alaq/nucleus/index'
import { eternalSym, flightySym } from '@alaq/atom/property'

const space = {
  N,
  plugins: [],
  stabilized: 0,
} as any

export function setupNucleonForAtoms(n: INucleonConstructor<any>) {
  space.N = n
}

export default function create<T>(model?: T, options = {} as AtomOptions) {
  const core = {
    eternal: options.nucleusStrategy === 'eternal',
    ...options,
  } as DeepAtomCore

  if (space.plugins.length !== space.stabilized) {
    // space.plugins.forEach(installNucleonExtension)
    space.plugins.length = space.stabilized
  }

  function one(secondName?: string, extendObject?: Record<string, INucleon<any>>) {
    core.nucleons = extendObject ? extendObject : {}
    let superModel
    if (typeof model === 'function') {
      //@ts-ignore
      superModel = new model()
    } else {
      superModel = model
    }
    const listeners = []
    core.proxy = new Proxy(
      {},
      {
        apply(target: {}, thisArg: any, argArray: any[]): any {
          return core.nucleons
        },
        get(t, key: string): any {
          const n = core.nucleons[key] || synthNucleon(key, superModel, core)
          core.listener && n.up((v) => core.listener(key, v))
          return n
        },
      },
    )
    return core.proxy as PureAtom<T>
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

  const ways = {
    one,
    many,
    name(lastName) {
      core.name = lastName
      return {
        one,
        many,
        eternal(...onlyNucleons: string[]) {
          core.eternal = onlyNucleons.length ? onlyNucleons : true
          return {
            one,
            many,
          }
        },
      }
    },
  }

  function listener(fn: (key, value) => void) {
    core.listener = fn
    return ways
  }

  return {
    listener,
    ...ways,
  }
}

function synthNucleon(key, model, core: DeepAtomCore) {
  let nucleon: INucleon<any> = core.nucleons[key]
  if (!nucleon) {
    const id = core.name ? `${core.name}.${key}` : key
    let modelValue = model ? model[key] : undefined,
      mem
    if (typeof core.eternal === 'boolean') {
      mem = core.eternal
    } else {
      mem = core.eternal && core.eternal.indexOf(key) !== -1
    }
    core.nucleons[key] = nucleon = space.N()

    if (isDefined(modelValue)) {
      switch (modelValue.sym) {
        case eternalSym:
          modelValue = modelValue.startValue
          mem = true
          break
        case flightySym:
          modelValue = modelValue.startValue
          mem = false
          break
      }
    }
    switch (core.nucleusStrategy) {
      case 'holistic':
        nucleon.holistic()
        break
      case 'stateless':
        nucleon.stateless()
        break
      case 'holystate':
        nucleon.holistic()
        nucleon.stateless()
        break
    }
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
