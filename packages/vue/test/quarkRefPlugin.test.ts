/**
 * Tests for VueQuarkRefPlugin
 */

import { test } from 'tap'
import { Atom } from '@alaq/atom'
import { VueQuarkRefPlugin } from '../src/plugins/quarkRefPlugin'
import { watch, isRef } from 'vue'

test('VueQuarkRefPlugin - makes quark behave like Vue ref', async (t) => {
  Atom.use(VueQuarkRefPlugin)

  class Counter {
    count = 0
    name = 'test'
  }

  const counter = Atom(Counter)

  // Check that quark has Vue ref markers
  t.ok(counter.core.count.__v_isRef, 'quark has __v_isRef marker')
  t.ok(isRef(counter.core.count), 'quark is recognized as ref by Vue')

  // Check value access
  t.equal(counter.core.count.value, 0, 'initial value is correct')

  // Test reactivity tracking
  let watchedValue: number | undefined
  const stop = watch(() => counter.core.count.value, (newValue) => {
    watchedValue = newValue
  })

  // Change via quark
  counter.core.count(10)
  await new Promise(resolve => setTimeout(resolve, 10))
  t.equal(watchedValue, 10, 'watch triggered when quark changes')
  t.equal(counter.core.count.value, 10, 'value updated')

  // Change via .value setter
  counter.core.count.value = 20
  await new Promise(resolve => setTimeout(resolve, 10))
  t.equal(watchedValue, 20, 'watch triggered when .value changes')
  t.equal(counter.core.count(), 20, 'quark internal value updated')

  stop()
  t.end()
})

test('VueQuarkRefPlugin - works with multiple properties', async (t) => {
  Atom.use(VueQuarkRefPlugin)

  class User {
    name = ''
    age = 0
    active = false
  }

  const user = Atom(User)

  // All properties should be refs
  t.ok(isRef(user.core.name), 'name is ref')
  t.ok(isRef(user.core.age), 'age is ref')
  t.ok(isRef(user.core.active), 'active is ref')

  // Set values
  user.core.name.value = 'Alice'
  user.core.age.value = 25
  user.core.active.value = true

  t.equal(user.state.name, 'Alice', 'state reflects name change')
  t.equal(user.state.age, 25, 'state reflects age change')
  t.equal(user.state.active, true, 'state reflects active change')

  t.end()
})

test('VueQuarkRefPlugin - cleanup on decay', (t) => {
  Atom.use(VueQuarkRefPlugin)

  class Temp {
    value = 100
  }

  const temp = Atom(Temp)
  t.ok(temp.core.value.__v_isRef, 'ref marker exists before decay')

  temp.decay()

  t.notOk(temp.core.value?.__v_isRef, 'ref marker removed after decay')
  t.end()
})
