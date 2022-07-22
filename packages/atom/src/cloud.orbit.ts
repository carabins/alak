/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import create from './create'

import cloudGetters from './cloud.getters'
import { cloudProxy } from './cloud.proxy'
import { eternalAtom } from '@alaq/atom/index'
import CloudElectrons from './cloud.electrons'

export default function (electrons: CloudElectrons, cloud, config) {
  const atom = create(electrons.instaValues, {
    name: config.name,
    nucleusStrategy: cloud.superEternal || electrons.eternalKeys,
  }).one()

  const state = cloudProxy.state(atom)
  const thisState = cloudProxy.warp(cloud.actions, state)
  const thisContext = config.thisExtension
    ? cloudProxy.warp(config.thisExtension, thisState)
    : thisState
  const sleepingNucleons = cloudGetters(electrons, config.name)

  Object.assign(cloud.sleepingNucleons, sleepingNucleons)

  Object.keys(electrons.actions).forEach((key) => {
    cloud.actions[key] = (...args) => {
      const fn = electrons.actions[key] as Function
      return fn.apply(thisContext, args)
    }
  })
  return { atom, state, sleepingNucleons, parts: electrons }
}