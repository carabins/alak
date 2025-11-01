/**
 * Tests for ViewMarkerPlugin
 */

import { test, expect } from 'bun:test'
import { Atom } from '@alaq/atom'
import { ViewMarkerPlugin, view, isView } from '../src/atomic-marker'
import { watch, isRef } from 'vue'

test('ViewMarkerPlugin - creates view namespace', () => {
  Atom.use(ViewMarkerPlugin)

  class User {
    name = view('Alice')
    age = 25
  }

  const user = Atom(User)

  expect(user.view).toBeDefined()
  expect(user.view.name).toBeDefined()
  expect(user.view.age).not.toBeDefined()
})

test('ViewMarkerPlugin - marked properties become refs', () => {
  Atom.use(ViewMarkerPlugin)

  class Counter {
    count = view(0)
    internal = 100
  }

  const counter = Atom(Counter)

  // Check that marked property is a ref
  expect(isRef(counter.view.count)).toBe(true)
  expect(counter.view.count.value).toBe(0)

  // Check that unmarked property is NOT in view
  expect(counter.view.internal).not.toBeDefined()
  expect(counter.state.internal).toBe(100)
})

test('ViewMarkerPlugin - view refs are reactive', async () => {
  Atom.use(ViewMarkerPlugin)

  class User {
    username = view('')
  }

  const user = Atom(User)
  const changes: string[] = []

  // Watch view ref
  const stop = watch(() => user.view.username.value, (newValue) => {
    changes.push(newValue)
  })

  // Update via ref
  user.view.username.value = 'alice'
  await new Promise(resolve => setTimeout(resolve, 10))

  expect(changes.length).toBe(1)
  expect(changes[0]).toBe('alice')

  // Check that quark was updated
  expect(user.core.username.value).toBe('alice')
  expect(user.state.username).toBe('alice')

  stop()
})

test('ViewMarkerPlugin - quark changes update view ref', async () => {
  Atom.use(ViewMarkerPlugin)

  class Counter {
    count = view(0)
  }

  const counter = Atom(Counter)
  const changes: number[] = []

  // Watch view ref
  const stop = watch(() => counter.view.count.value, (newValue) => {
    changes.push(newValue)
  })

  // Update via quark
  counter.core.count(42)
  await new Promise(resolve => setTimeout(resolve, 10))

  expect(changes.length).toBe(1)
  expect(changes[0]).toBe(42)
  expect(counter.view.count.value).toBe(42)

  stop()
})

test('ViewMarkerPlugin - multiple marked properties', () => {
  Atom.use(ViewMarkerPlugin)

  class Form {
    email = view('')
    password = view('')
    remember = view(false)
    internalToken = 'abc123'
  }

  const form = Atom(Form)

  // Check view namespace
  expect(isRef(form.view.email)).toBe(true)
  expect(isRef(form.view.password)).toBe(true)
  expect(isRef(form.view.remember)).toBe(true)
  expect(form.view.internalToken).not.toBeDefined()

  // Set values
  form.view.email.value = 'user@example.com'
  form.view.password.value = 'secret'
  form.view.remember.value = true

  // Check state updated
  expect(form.state.email).toBe('user@example.com')
  expect(form.state.password).toBe('secret')
  expect(form.state.remember).toBe(true)
})

test('ViewMarkerPlugin - isView helper', () => {
  const markedValue = view(42)
  const normalValue = 42

  expect(isView(markedValue)).toBe(true)
  expect(isView(normalValue)).toBe(false)
  expect(isView(null)).toBe(false)
  expect(isView(undefined)).toBe(false)
})

test('ViewMarkerPlugin - cleanup on decay', () => {
  Atom.use(ViewMarkerPlugin)

  class Temp {
    value = view(100)
  }

  const temp = Atom(Temp)
  expect(temp.view).toBeDefined()
  expect(temp.view.value).toBeDefined()

  temp.decay()

  expect(temp.view).not.toBeDefined()
})

test('ViewMarkerPlugin - combining with unmarked properties', async () => {
  Atom.use(ViewMarkerPlugin)

  class AppState {
    // Marked for UI
    counter = view(0)
    username = view('')

    // Unmarked internal state
    cache = new Map()
    logs: string[] = []
  }

  const app = Atom(AppState)

  // Marked properties in view
  expect(isRef(app.view.counter)).toBe(true)
  expect(isRef(app.view.username)).toBe(true)

  // Unmarked properties NOT in view
  expect(app.view.cache).not.toBeDefined()
  expect(app.view.logs).not.toBeDefined()

  // Unmarked properties in state
  expect(app.state.cache instanceof Map).toBe(true)
  expect(Array.isArray(app.state.logs)).toBe(true)

  // Mutate unmarked - no Vue reactivity overhead
  app.state.cache.set('key', 'value')
  app.state.logs.push('event')

  expect(app.state.cache.get('key')).toBe('value')
  expect(app.state.logs.length).toBe(1)
})
