// import {installNucleonExtension} from "@alaq/nucleus/create";
import { storage } from './storage'
import { isDefined } from './extra'
import N from '@alaq/nucleus/index'
import { eternalSym, externalSym, flightySym } from '@alaq/atom/property'

const nonNucleons = ['constructor']
export default function (key, valence, core: DeepAtomCore<any>) {
  let nucleon: INucleon<any> = core.nucleons[key]
  if (!nucleon && !nonNucleons.includes(key)) {
    const id = core.name ? `${core.name}.${key}` : key
    let modelValue = valence ? valence[key] : undefined,
      mem,
      external,
      broadcast

    if (typeof core.eternal === 'boolean') {
      mem = core.eternal
    } else {
      //@ts-ignore
      mem = core.eternal && core.eternal.indexOf(key) !== -1
    }
    core.nucleons[key] = nucleon = N()
    if (isDefined(modelValue)) {
      switch (modelValue.sym) {
        case externalSym:
          external = modelValue.external || true
          modelValue = modelValue.startValue
          break
        case eternalSym:
          modelValue = modelValue.startValue
          mem = true
          break
        case flightySym:
          modelValue = modelValue.startValue
          mem = false
          break
        // case broadcasterSum:
        //   broadcast = true
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

    if (external) {
      core.quarkBus.dispatchEvent('INIT', {
        external,
        nucleon,
      })
    }
  }

  if (core.emitChanges) {
    nucleon.up((value) => {
      core.quarkBus.dispatchEvent('NUCLEON_CHANGE', {
        key,
        value,
        core: core.name,
        nucleon,
      })
    })
  }

  return nucleon
}
