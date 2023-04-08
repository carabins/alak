/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import { QuarkEventBus } from '@alaq/nucleus/index'
import cloudOrbit from './cloud.orbit'
import cloudParse from './cloud.parse'
import CloudElectrons from './cloud.electrons'

export default function <Model, Eternal>(atomOptions: AtomOptions<Model>) {
  const cloud = {
    nucleons: {},
    actions: {},
    sleepingNucleons: {},
    superEternal: false,
  }

  const electrons = new CloudElectrons(getNucleon, cloud)

  if (atomOptions.nucleusStrategy === 'eternal' || atomOptions.eternal === '*') {
    cloud.superEternal = true
  } else if (
    typeof atomOptions.eternal !== 'string' &&
    atomOptions.eternal &&
    typeof atomOptions.eternal[0] === 'string'
  ) {
    electrons.eternalKeys = atomOptions.eternal as string[]
  }

  const findElectrons = (model, isEternal?) => {
    const parts = cloudParse(model, atomOptions)
    Object.assign(electrons.actions, parts.actions)
    Object.assign(electrons.getters, parts.getters)
    Object.assign(electrons.instaValues, parts.instaValues)
    electrons.addEternals(parts.eternals)
    if (isEternal) {
      electrons.addEternals(Object.keys(parts.instaValues))
    }
  }

  atomOptions.model && findElectrons(atomOptions.model)
  atomOptions.eternal && findElectrons(atomOptions.eternal, true)

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
    return nucleon
  }

  return {
    core: electrons.core,
    state: electrons.state,
    actions: cloud.actions,
    bus,
  } as IAtom<Model>
}
