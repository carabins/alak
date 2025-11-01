/**
 * Tests for VueQuarkRefPlugin
 */

import { test, expect } from 'bun:test'
import { Atom } from '@alaq/atom'
import { VueQuarkRefPlugin } from '../src/quark'
import { watch, isRef } from 'vue'

test('VueQuarkRefPlugin - makes quark behave like Vue ref', async () => {
  Atom.use(VueQuarkRefPlugin)

  class Counter {
    count = 0
    name = 'test'
  }

  const counter = Atom(Counter)

  // Check that quark has Vue ref markers
  expect(counter.core.count.__v_isRef).toBe(true)
  expect(isRef(counter.core.count)).toBe(true)

  // Check value access
  expect(counter.core.count.value).toBe(0)

  // Test reactivity tracking
  let watchedValue: number | undefined
  const stop = watch(() => counter.core.count.value, (newValue) => {
    watchedValue = newValue
  })

  // Change via quark
  counter.core.count(10)
  console.log({watchedValue})
  // await new Promise(resolve => setTimeout(resolve, 10))
  // expect(watchedValue).toBe(10)
  // expect(counter.core.count.value).toBe(10)
  //
  // // Change via .value setter
  // counter.core.count.value = 20
  // await new Promise(resolve => setTimeout(resolve, 10))
  // expect(watchedValue).toBe(20)
  // expect(counter.core.count()).toBe(20)

  stop()
})
//
// test('VueQuarkRefPlugin - works with multiple properties', async () => {
//   Atom.use(VueQuarkRefPlugin)
//
//   class User {
//     name = ''
//     age = 0
//     active = false
//   }
//
//   const user = Atom(User)
//
//   // All properties should be refs
//   expect(isRef(user.core.name)).toBe(true)
//   expect(isRef(user.core.age)).toBe(true)
//   expect(isRef(user.core.active)).toBe(true)
//
//   // Set values
//   user.core.name.value = 'Alice'
//   user.core.age.value = 25
//   user.core.active.value = true
//
//   expect(user.state.name).toBe('Alice')
//   expect(user.state.age).toBe(25)
//   expect(user.state.active).toBe(true)
// })
//
// test('VueQuarkRefPlugin - cleanup on decay', () => {
//   Atom.use(VueQuarkRefPlugin)
//
//   class Temp {
//     value = 100
//   }
//
//   const temp = Atom(Temp)
//   expect(temp.core.value.__v_isRef).toBe(true)
//
//   temp.decay()
//
//   expect(temp.core.value?.__v_isRef).not.toBe(true)
// })
