/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import { QuarkEventBus } from '@alaq/nucleus/index'
import cloudOrbit from './cloud.orbit'
import cloudParse from './cloud.parse'
import CloudElectrons from './cloud.electrons'

export default function <Model, Eternal>(atomOptions: IAtomOptions<Model>) {
  const cloud = {
    nucleons: {},
    actions: {},
    sleepingNucleons: {},
    superEternal: false,
  }

  const knownKeys = {}
  const knownActions = {}
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
    Object.keys(electrons.actions).forEach((k) => {
      knownActions[k] = true
    })
    const instaKeys = Object.keys(parts.instaValues)
    instaKeys.forEach((k) => {
      knownKeys[k] = true
    })
    if (isEternal) {
      electrons.addEternals(instaKeys)
    }
  }

  atomOptions.model && findElectrons(atomOptions.model)
  atomOptions.saved && findElectrons(atomOptions.saved, true)

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

  return {
    core: electrons.core,
    state: electrons.state,
    actions: cloud.actions,
    bus,
    cloud,
    knownKeys,
    knownActions,
  } as any as IAtom<Model>
}
