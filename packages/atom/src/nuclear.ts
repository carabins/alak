// import {installNucleonExtension} from "@alaq/nucleus/create";
import { storage } from './storage'

import N from '@alaq/nucleus/index'
import {savedSym, runeSym, statelessSym, mixedSum} from '@alaq/atom/property'
import isDefined from '@alaq/rune/isDefined'

const nonNucleons = ['constructor']
export default function (key, valence, core: IDeepAtomCore<any>) {
  let nucleon: INucleus<any> = core.nucleons[key]
  if (!nucleon && !nonNucleons.includes(key)) {
    const id = core.name ? `${core.name}.${key}` : key
    let modelValue, mem, rune, broadcast

    if (valence) {
      let v = valence[key]
      if (isDefined(v)) {
        modelValue = v
        delete valence[key]
      }
    }

    if (typeof core.saved === 'boolean') {
      mem = core.saved
    } else {
      //@ts-ignore
      mem = core.saved && core.saved.indexOf(key) !== -1
    }
    core.nucleons[key] = nucleon = N()
    const defineRune = mv => {
      switch (mv.sym) {
        case mixedSum:
          mv.startValue.forEach(v=>{
            defineRune(v)
          })
          break
        case runeSym:
          rune = mv.rune || true
          modelValue = mv.startValue
          break
        case savedSym:
          modelValue = mv.startValue
          mem = true
          break
        case statelessSym:
          modelValue = mv.startValue
          mem = false
          break
      }
    }
    isDefined(modelValue) && modelValue.sym && defineRune(modelValue)

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

    if (core.emitChanges) {
      nucleon.up((value) => {
        core.quarkBus.dispatchEvent('NUCLEUS_CHANGE', {
          key,
          value,
          atomId: core.name,
          n: nucleon,
        })
      })
    }

    core.quarkBus.dispatchEvent('NUCLEUS_INIT', { rune, nucleus: nucleon })
  }

  return nucleon
}
