/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import { QuarkEventBus } from '@alaq/nucleus/index'
import cloudOrbit from './cloud.orbit'
import cloudParse from './cloud.parse'
import CloudElectrons from './cloud.electrons'
import { deleteParams } from '@alaq/nucleus/utils'
import Model from '../test/bud/model'

export default function <Model, Eternal>(atomOptions: IAtomOptions<Model>) {
  const cloud = {
    nucleons: {},
    actions: {},
    sleepingNucleons: {},
    superEternal: false,
  }

  const known = {
    values() {
      const o = {} as PureModel<Instance<Model>>
      known.keys.forEach((k) => {
        o[k] = electrons.state[k]
      })
      return o
    },
  } as IAtomKnown<Model>
  const knownKeys = new Set()
  const knownActions = new Set()
  const electrons = new CloudElectrons(getNucleon, cloud)

  if (atomOptions.nucleusStrategy === 'saved' || atomOptions.saved === '*') {
    cloud.superEternal = true
  } else if (
    typeof atomOptions.saved !== 'string' &&
    atomOptions.saved &&
    typeof atomOptions.saved[0] === 'string'
  ) {
    electrons.savedKeys = atomOptions.saved as string[]
  }

  const findElectrons = (model, isEternal?) => {
    const parts = cloudParse(model, atomOptions)
    Object.assign(electrons.actions, parts.actions)
    Object.assign(electrons.getters, parts.getters)
    Object.assign(electrons.instaValues, parts.instaValues)
    electrons.addEternals(parts.saveds)
    const onlyPublic = (k) => !k.startsWith('_')
    known.actions = new Set<string>(Object.keys(electrons.actions).filter(onlyPublic))
    const instaKeys = Object.keys(parts.instaValues)
    instaKeys.push(...Object.keys(parts.getters))
    known.keys = new Set(instaKeys.filter(onlyPublic))
    if (isEternal) {
      electrons.addEternals(instaKeys)
    }
  }

  atomOptions.model && findElectrons(atomOptions.model)
  atomOptions.saved && findElectrons(atomOptions.saved, true)

  const externalBus = !!atomOptions.bus
  const bus = atomOptions.bus || QuarkEventBus()

  const orbital = cloudOrbit(electrons, cloud, atomOptions, bus)

  function getNucleon(key) {
    let nucleon = cloud.sleepingNucleons[key]
    if (nucleon) {
      const wakeup = nucleon.getMeta('sleep')
      wakeup()
      nucleon.deleteMeta('sleep')
      cloud.nucleons[key] = nucleon
      delete cloud.sleepingNucleons[key]
    } else {
      nucleon = cloud.nucleons[key] || orbital.atom[key]
    }
    if (!knownKeys) {
      knownKeys[key] = true
    }
    return nucleon
  }

  const atom = {
    core: electrons.core,
    state: electrons.state,
    actions: cloud.actions,
    decay,
    bus,
    known,
  } as IAtom<Model>

  function decay() {
    Object.keys(knownKeys).forEach((key) => {
      let nucleon = cloud.sleepingNucleons[key] || cloud.nucleons[key] || orbital.atom[key]
      if (nucleon) {
        nucleon.decay()
      }
    })
    if (externalBus) {
      bus.decay()
    }
    deleteParams(atom)
    deleteParams(orbital)
    deleteParams(known)
  }

  return atom
}
