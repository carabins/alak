// Copyright (c) Gleb Panteleev. All rights reserved. Licensed under the MIT license.

/**
 * Расширение атома для vue
 * @remarks
 * @packageDocumentation
 */

import { ref, Ref, watch } from 'vue'

import { A, installAtomExtension } from 'alak/index'

const isNCall = {
  toJSON: true,
  _rawValue: true,
  _shallow: true,
  __v_isRef: true,
  _value: true,
  value: true,
  bind: true,
  call: true,
  apply: true,
}

installAtomExtension({
  proxy(core) {
    let link
    let watched = false

    function cast() {
      link = ref()
      core._.up((v) => (link.value = v))
    }

    function castWatch() {
      watched = true
      watch(link, (v) => {
        core(v)
      })
    }

    return new Proxy(core, {
      set(o, key, value) {
        if (isNCall[key] && link) {
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
        if (link && isNCall[key]) {
          return link[key]
        }
        switch (key) {
          case 'ref':
            if (!link) cast()
            return link
          case 'refWatch':
            if (!link) cast()
            castWatch()
            return link
          case 'rv':
          case 'vv':
            if (!link) cast()
            return link.value
          default:
            return core[key]
        }
      },
    })
  },
})
