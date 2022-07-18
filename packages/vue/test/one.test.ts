/*
 * Copyright (c) 2022.  Only the truth - liberates.
 */
import { test } from 'tap'

import { Nucleus, installNucleonExtensions } from '@alaq/nucleus/index'
import vueNucleonExtension from '../src'

test('install', (t) => {
  const startValue = 12
  const n = Nucleus(startValue)
  installNucleonExtensions(vueNucleonExtension)
  const r = n.ref
  t.equal(r.value, n.value)
  t.equal(r.value, n.vv)
  // const rv = n.refWatch
  // t.equal(rv.value, n.value)
  // n(24)
  // t.equal(r.value, n.value)
  // t.equal(rv.value, n.value)
  // rv.value = 3
  setTimeout(() => {
    // t.equal(r.value, n.value)
    // t.equal(rv.value, n.value)
    t.end()
  }, 1)
})
