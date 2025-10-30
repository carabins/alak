import { test, expect } from 'bun:test'
import { Atom } from 'alak/index'
import { watchVueAtom } from '../src'
import { nextTick } from 'vue'

class ModelWithObject {
  user = { name: 'John', age: 30 }
  config = { theme: 'light', settings: { fontSize: 14 } }
}

class ModelWithArray {
  items = [1, 2, 3]
  users = [{ name: 'Alice' }, { name: 'Bob' }]
}

class ModelMixed {
  count = 0
  items = [1, 2, 3]
  user = { name: 'John', age: 30 }
}

test('sync: object property change', async () => {
  const atom = Atom({ model: ModelWithObject, name: 'test1' })
  const reactive = watchVueAtom(atom)

  // Change nested property from Vue side
  reactive.user.name = 'Jane'
  await nextTick()

  // Should sync to atom
  expect(atom.state.user.name).toBe('Jane')
})

test('sync: deep nested object property change', async () => {
  const atom = Atom({ model: ModelWithObject, name: 'test2' })
  const reactive = watchVueAtom(atom)

  // Change deeply nested property
  reactive.config.settings.fontSize = 16
  await nextTick()

  expect(atom.state.config.settings.fontSize).toBe(16)
})

test('sync: replace entire object', async () => {
  const atom = Atom({ model: ModelWithObject, name: 'test3' })
  const reactive = watchVueAtom(atom)

  // Replace entire object
  reactive.user = { name: 'Alice', age: 25 }
  await nextTick()

  expect(atom.state.user.name).toBe('Alice')
  expect(atom.state.user.age).toBe(25)
})

test('sync: object change from atom to vue', async () => {
  const atom = Atom({ model: ModelWithObject, name: 'test4' })
  const reactive = watchVueAtom(atom)

  // Change from atom side
  atom.core.user({ name: 'Bob', age: 40 })
  await nextTick()

  expect(reactive.user.name).toBe('Bob')
  expect(reactive.user.age).toBe(40)
})

test('sync: array push', async () => {
  const atom = Atom({ model: ModelWithArray, name: 'test5' })
  const reactive = watchVueAtom(atom)

  // Push item
  reactive.items.push(4)
  await nextTick()

  expect(atom.state.items.length).toBe(4)
  expect(atom.state.items[3]).toBe(4)
})

test('sync: array splice', async () => {
  const atom = Atom({ model: ModelWithArray, name: 'test6' })
  const reactive = watchVueAtom(atom)

  // Remove first item
  reactive.items.splice(0, 1)
  await nextTick()

  expect(atom.state.items.length).toBe(2)
  expect(atom.state.items[0]).toBe(2)
})

test('sync: array item property change', async () => {
  const atom = Atom({ model: ModelWithArray, name: 'test7' })
  const reactive = watchVueAtom(atom)

  // Change property of array item
  reactive.users[0].name = 'Alicia'
  await nextTick()

  expect(atom.state.users[0].name).toBe('Alicia')
})

test('sync: array replace', async () => {
  const atom = Atom({ model: ModelWithArray, name: 'test8' })
  const reactive = watchVueAtom(atom)

  // Replace entire array
  reactive.items = [10, 20, 30]
  await nextTick()

  expect(atom.state.items.length).toBe(3)
  expect(atom.state.items[0]).toBe(10)
})

test('sync: array unshift', async () => {
  const atom = Atom({ model: ModelWithArray, name: 'test9' })
  const reactive = watchVueAtom(atom)

  // Add item to beginning
  reactive.items.unshift(0)
  await nextTick()

  expect(atom.state.items.length).toBe(4)
  expect(atom.state.items[0]).toBe(0)
})

test('sync: array pop', async () => {
  const atom = Atom({ model: ModelWithArray, name: 'test10' })
  const reactive = watchVueAtom(atom)

  // Remove last item
  const popped = reactive.items.pop()
  await nextTick()

  expect(popped).toBe(3)
  expect(atom.state.items.length).toBe(2)
})

test('sync: mixed primitives and complex types', async () => {
  const atom = Atom({ model: ModelMixed, name: 'test11' })
  const reactive = watchVueAtom(atom)

  // Change primitive
  reactive.count = 5
  await nextTick()
  expect(atom.state.count).toBe(5)

  // Change array
  reactive.items.push(4)
  await nextTick()
  expect(atom.state.items.length).toBe(4)

  // Change object
  reactive.user.name = 'Jane'
  await nextTick()
  expect(atom.state.user.name).toBe('Jane')
})

test('sync: bidirectional sync', async () => {
  const atom = Atom({ model: ModelWithObject, name: 'test12' })
  const reactive = watchVueAtom(atom)

  // Vue -> Atom
  reactive.user.name = 'Alice'
  await nextTick()
  expect(atom.state.user.name).toBe('Alice')

  // Atom -> Vue
  atom.core.user({ name: 'Bob', age: 50 })
  await nextTick()
  expect(reactive.user.name).toBe('Bob')
  expect(reactive.user.age).toBe(50)

  // Vue -> Atom again
  reactive.user.age = 55
  await nextTick()
  expect(atom.state.user.age).toBe(55)
})

test('sync: no infinite loops with dedup', async () => {
  const atom = Atom({ model: ModelWithObject, name: 'test13' })
  const reactive = watchVueAtom(atom, true) // dedup enabled

  let atomUpdateCount = 0
  atom.core.user.up(() => {
    atomUpdateCount++
  })

  // Set same value - should not trigger infinite loop
  const currentUser = reactive.user
  reactive.user = currentUser
  await nextTick()

  expect(atomUpdateCount <= 2).toBeTruthy()
})

test('sync: array reverse', async () => {
  const atom = Atom({ model: ModelWithArray, name: 'test14' })
  const reactive = watchVueAtom(atom)

  reactive.items.reverse()
  await nextTick()

  expect(atom.state.items[0]).toBe(3)
  expect(atom.state.items[2]).toBe(1)
})

test('sync: array sort', async () => {
  const atom = Atom({ model: ModelWithArray, name: 'test15' })
  const reactive = watchVueAtom(atom)

  reactive.items = [3, 1, 2]
  await nextTick()

  reactive.items.sort()
  await nextTick()

  expect(atom.state.items[0]).toBe(1)
  expect(atom.state.items[2]).toBe(3)
})
