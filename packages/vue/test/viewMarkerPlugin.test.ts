/**
 * Tests for ViewMarkerPlugin
 */

import { test } from 'tap'
import { Atom } from '@alaq/atom'
import { ViewMarkerPlugin, view, isView } from '../src/plugins/viewMarkerPlugin'
import { watch, isRef } from 'vue'

test('ViewMarkerPlugin - creates view namespace', (t) => {
  Atom.use(ViewMarkerPlugin)

  class User {
    name = view('Alice')
    age = 25
  }

  const user = Atom(User)

  t.ok(user.view, 'atom has .view namespace')
  t.ok(user.view.name, 'view.name exists')
  t.notOk(user.view.age, 'unmarked property not in view namespace')

  t.end()
})

test('ViewMarkerPlugin - marked properties become refs', (t) => {
  Atom.use(ViewMarkerPlugin)

  class Counter {
    count = view(0)
    internal = 100
  }

  const counter = Atom(Counter)

  // Check that marked property is a ref
  t.ok(isRef(counter.view.count), 'marked property is ref')
  t.equal(counter.view.count.value, 0, 'ref has correct initial value')

  // Check that unmarked property is NOT in view
  t.notOk(counter.view.internal, 'unmarked property not in view')
  t.equal(counter.state.internal, 100, 'unmarked property in state')

  t.end()
})

test('ViewMarkerPlugin - view refs are reactive', async (t) => {
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

  t.equal(changes.length, 1, 'watch triggered')
  t.equal(changes[0], 'alice', 'watch received correct value')

  // Check that quark was updated
  t.equal(user.core.username.value, 'alice', 'quark updated from ref')
  t.equal(user.state.username, 'alice', 'state updated from ref')

  stop()
  t.end()
})

test('ViewMarkerPlugin - quark changes update view ref', async (t) => {
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

  t.equal(changes.length, 1, 'watch triggered')
  t.equal(changes[0], 42, 'watch received correct value')
  t.equal(counter.view.count.value, 42, 'view ref updated')

  stop()
  t.end()
})

test('ViewMarkerPlugin - multiple marked properties', (t) => {
  Atom.use(ViewMarkerPlugin)

  class Form {
    email = view('')
    password = view('')
    remember = view(false)
    internalToken = 'abc123'
  }

  const form = Atom(Form)

  // Check view namespace
  t.ok(isRef(form.view.email), 'email is ref')
  t.ok(isRef(form.view.password), 'password is ref')
  t.ok(isRef(form.view.remember), 'remember is ref')
  t.notOk(form.view.internalToken, 'unmarked prop not in view')

  // Set values
  form.view.email.value = 'user@example.com'
  form.view.password.value = 'secret'
  form.view.remember.value = true

  // Check state updated
  t.equal(form.state.email, 'user@example.com', 'email in state')
  t.equal(form.state.password, 'secret', 'password in state')
  t.equal(form.state.remember, true, 'remember in state')

  t.end()
})

test('ViewMarkerPlugin - isView helper', (t) => {
  const markedValue = view(42)
  const normalValue = 42

  t.ok(isView(markedValue), 'view() creates viewable value')
  t.notOk(isView(normalValue), 'normal value is not viewable')
  t.notOk(isView(null), 'null is not viewable')
  t.notOk(isView(undefined), 'undefined is not viewable')

  t.end()
})

test('ViewMarkerPlugin - cleanup on decay', (t) => {
  Atom.use(ViewMarkerPlugin)

  class Temp {
    value = view(100)
  }

  const temp = Atom(Temp)
  t.ok(temp.view, 'view namespace exists')
  t.ok(temp.view.value, 'view ref exists')

  temp.decay()

  t.notOk(temp.view, 'view namespace removed after decay')

  t.end()
})

test('ViewMarkerPlugin - combining with unmarked properties', async (t) => {
  Atom.use(ViewMarkerPlugin)

  class AppState {
    // Marked for UI
    counter = view(0)
    username = view('')

    // Unmarked internal state
    cache = new Map()
    logs = []
  }

  const app = Atom(AppState)

  // Marked properties in view
  t.ok(isRef(app.view.counter), 'counter in view')
  t.ok(isRef(app.view.username), 'username in view')

  // Unmarked properties NOT in view
  t.notOk(app.view.cache, 'cache not in view')
  t.notOk(app.view.logs, 'logs not in view')

  // Unmarked properties in state
  t.ok(app.state.cache instanceof Map, 'cache in state')
  t.ok(Array.isArray(app.state.logs), 'logs in state')

  // Mutate unmarked - no Vue reactivity overhead
  app.state.cache.set('key', 'value')
  app.state.logs.push('event')

  t.equal(app.state.cache.get('key'), 'value', 'cache mutation works')
  t.equal(app.state.logs.length, 1, 'logs mutation works')

  t.end()
})
