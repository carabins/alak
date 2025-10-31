/**
 * Tests for StateReactivePlugin
 */

import { test } from 'tap'
import { Atom } from '@alaq/atom'
import { StateReactivePlugin } from '../src/plugins/stateReactivePlugin'
import { watch, isReactive, toRaw } from 'vue'

test('StateReactivePlugin - makes state reactive', async (t) => {
  Atom.use(StateReactivePlugin)

  class User {
    profile = { name: '', age: 0 }
    tags = ['vue']
  }

  const user = Atom(User)

  // Check reactive markers
  t.ok(user.state.__v_isReactive, 'state has __v_isReactive marker')
  t.ok(isReactive(user.state), 'state is recognized as reactive by Vue')

  t.end()
})

test('StateReactivePlugin - tracks deep object changes', async (t) => {
  Atom.use(StateReactivePlugin)

  class User {
    profile = { name: '', age: 0 }
  }

  const user = Atom(User)
  const changes: string[] = []

  // Watch deep property
  const stop = watch(() => user.state.profile.name, (newValue) => {
    changes.push(newValue)
  })

  // Mutate nested property
  user.state.profile.name = 'Alice'
  await new Promise(resolve => setTimeout(resolve, 10))

  t.equal(changes.length, 1, 'watch triggered once')
  t.equal(changes[0], 'Alice', 'watch received correct value')
  t.equal(user.state.profile.name, 'Alice', 'state updated')

  // Check that quark was updated
  t.equal(user.core.profile.value.name, 'Alice', 'quark value updated')

  stop()
  t.end()
})

test('StateReactivePlugin - tracks array mutations', async (t) => {
  Atom.use(StateReactivePlugin)

  class TodoList {
    items = ['task1']
  }

  const list = Atom(TodoList)
  const changes: number[] = []

  // Watch array length
  const stop = watch(() => user.state.items.length, (newLength) => {
    changes.push(newLength)
  })

  // Push new item
  list.state.items.push('task2')
  await new Promise(resolve => setTimeout(resolve, 10))

  t.equal(changes.length, 1, 'watch triggered')
  t.equal(changes[0], 2, 'new length is 2')
  t.same(list.state.items, ['task1', 'task2'], 'array updated')

  stop()
  t.end()
})

test('StateReactivePlugin - rawState() returns clean data', (t) => {
  Atom.use(StateReactivePlugin)

  class User {
    profile = { name: 'Bob', age: 30 }
    tags = ['vue', 'typescript']
  }

  const user = Atom(User)

  // Mutate state
  user.state.profile.name = 'Alice'
  user.state.tags.push('atom')

  // Get raw state
  const raw = user.rawState()

  t.same(raw, {
    profile: { name: 'Alice', age: 30 },
    tags: ['vue', 'typescript', 'atom']
  }, 'rawState has correct values')

  // Check that raw is not reactive
  t.notOk(isReactive(raw.profile), 'raw profile is not reactive')
  t.notOk(isReactive(raw.tags), 'raw tags is not reactive')

  t.end()
})

test('StateReactivePlugin - syncs quark changes to state', async (t) => {
  Atom.use(StateReactivePlugin)

  class Counter {
    count = 0
  }

  const counter = Atom(Counter)
  const changes: number[] = []

  // Watch state
  const stop = watch(() => counter.state.count, (newValue) => {
    changes.push(newValue)
  })

  // Update via quark
  counter.core.count(10)
  await new Promise(resolve => setTimeout(resolve, 10))

  t.equal(changes.length, 1, 'watch triggered')
  t.equal(changes[0], 10, 'watch received correct value')
  t.equal(counter.state.count, 10, 'state updated')

  stop()
  t.end()
})

test('StateReactivePlugin - handles complex nested structures', async (t) => {
  Atom.use(StateReactivePlugin)

  class App {
    config = {
      ui: {
        theme: 'dark',
        layout: { sidebar: true }
      },
      features: ['a', 'b']
    }
  }

  const app = Atom(App)
  const themeChanges: string[] = []

  // Watch deeply nested property
  const stop = watch(() => app.state.config.ui.theme, (theme) => {
    themeChanges.push(theme)
  })

  // Mutate deeply nested
  app.state.config.ui.theme = 'light'
  await new Promise(resolve => setTimeout(resolve, 10))

  t.equal(themeChanges[0], 'light', 'deep watch works')
  t.equal(app.state.config.ui.theme, 'light', 'deep state updated')

  // Check rawState
  const raw = app.rawState()
  t.equal(raw.config.ui.theme, 'light', 'rawState reflects changes')
  t.notOk(isReactive(raw.config), 'rawState is not reactive')

  stop()
  t.end()
})
