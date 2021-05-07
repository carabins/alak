// Copyright (c) Gleb Panteleev. All rights reserved. Licensed under the MIT license.

/**
 * Расширение атома для vue
 * @remarks
 * @packageDocumentation
 */

// @ts-ignore
import { ref, Ref, watch } from 'vue'
// @ts-ignore
import { A, installAtomExtension } from 'alak'

const isRef = {
  toJSON: true,
  _rawValue: true,
  _shallow: true,
  __v_isRef: true,
  _value: true,
  value: true,
}

installAtomExtension({
  proxy(core) {
    let link
    let watched = false

    function cast() {
      link = ref()
      core._.up(v => (link.value = v))
    }

    function castWatch() {
      watched = true
      watch(link, v => core(v))
    }

    return new Proxy(core, {
      set(o, key, value) {
        if (isRef[key] && link) {
          link[key] = value
          if (key === 'value') {
            o(value)
          }
        } else {
          o[key] = value
        }
        return true
      },
      get(target, key) {
        if (link && isRef[key]) {
          return link[key]
        } else if (key == 'ref') {
          if (!link) cast()
          return link
        } else if (key == 'refWatch') {
          if (!link) cast()
          if (!watched) castWatch()
          return link
        } else {
          return core[key]
        }
      },
    })
  },
})

export default installAtomExtension
