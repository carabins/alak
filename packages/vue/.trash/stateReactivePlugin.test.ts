/**
 * Tests for StateReactivePlugin
 */

import { test, expect } from 'bun:test'
import { Atom } from '@alaq/atom'
import { StateReactivePlugin } from '../src/atomic-state'
import { watch, isReactive, toRaw } from 'vue'

test('StateReactivePlugin - makes state reactive', async () => {
  Atom.use(StateReactivePlugin)

  class User {
    profile = { name: '', age: 0 }
    tags = ['vue']
  }

  const user = Atom(User)

  // Check reactive markers
  expect(user.state.__v_isReactive).toBe(true)
  expect(isReactive(user.state)).toBe(true)
})

test('StateReactivePlugin - tracks deep object changes', async () => {
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

  expect(changes.length).toBe(1)
  expect(changes[0]).toBe('Alice')
  expect(user.state.profile.name).toBe('Alice')

  // Check that quark was updated
  expect(user.core.profile.value.name).toBe('Alice')

  stop()
})

test('StateReactivePlugin - tracks array mutations', async () => {
  Atom.use(StateReactivePlugin)

  class TodoList {
    items = ['task1']
  }

  const list = Atom(TodoList)
  const changes: number[] = []

  // Watch array length
  const stop = watch(() => list.state.items.length, (newLength) => {
    changes.push(newLength)
  })

  // Push new item
  list.state.items.push('task2')
  await new Promise(resolve => setTimeout(resolve, 10))

  expect(changes.length).toBe(1)
  expect(changes[0]).toBe(2)
  expect(list.state.items).toEqual(['task1', 'task2'])

  stop()
})

test('StateReactivePlugin - rawState() returns clean data', () => {
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

  expect(raw).toEqual({
    profile: { name: 'Alice', age: 30 },
    tags: ['vue', 'typescript', 'atom']
  })

  // Check that raw is not reactive
  expect(isReactive(raw.profile)).toBe(false)
  expect(isReactive(raw.tags)).toBe(false)
})

test('StateReactivePlugin - syncs quark changes to state', async () => {
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

  expect(changes.length).toBe(1)
  expect(changes[0]).toBe(10)
  expect(counter.state.count).toBe(10)

  stop()
})

test('StateReactivePlugin - handles complex nested structures', async () => {
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

  expect(themeChanges[0]).toBe('light')
  expect(app.state.config.ui.theme).toBe('light')

  // Check rawState
  const raw = app.rawState()
  expect(raw.config.ui.theme).toBe('light')
  expect(isReactive(raw.config)).toBe(false)

  stop()
})
