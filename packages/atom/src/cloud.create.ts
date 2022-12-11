/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import { QuarkEventBus } from '@alaq/nucleus/index'
import cloudOrbit from './cloud.orbit'
import cloudParse from './cloud.parse'
import CloudElectrons from './cloud.electrons'

export default function <Model, Eternal>(config: AtomOptions<Model>) {
  const cloud = {
    nucleons: {},
    actions: {},
    sleepingNucleons: {},
    superEternal: false,
  }

  const electrons = new CloudElectrons(getNucleon, cloud)

  if (config.nucleusStrategy === 'eternal' || config.eternal === '*') {
    cloud.superEternal = true
  } else if (
    typeof config.eternal !== 'string' &&
    config.eternal &&
    typeof config.eternal[0] === 'string'
  ) {
    electrons.eternalKeys = config.eternal as string[]
  }

  const findElectrons = (model, isEternal?) => {
    const parts = cloudParse(model, config)
    Object.assign(electrons.actions, parts.actions)
    Object.assign(electrons.getters, parts.getters)
    Object.assign(electrons.instaValues, parts.instaValues)
    electrons.addEternals(parts.eternals)
    if (isEternal) {
      electrons.addEternals(Object.keys(parts.instaValues))
    }
  }

  config.model && findElectrons(config.model)
  config.eternal && findElectrons(config.eternal, true)

  const bus = config.bus || QuarkEventBus()

  const orbital = cloudOrbit(electrons, cloud, config, bus)

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
