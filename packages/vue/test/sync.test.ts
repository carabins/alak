import { test } from 'tap'
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

test('sync: object property change', async (t) => {
  const atom = Atom({ model: ModelWithObject, name: 'test1' })
  const reactive = watchVueAtom(atom)

  // Change nested property from Vue side
  reactive.user.name = 'Jane'
  await nextTick()

  // Should sync to atom
  t.equal(atom.state.user.name, 'Jane', 'nested property synced to atom')
  t.end()
})

test('sync: deep nested object property change', async (t) => {
  const atom = Atom({ model: ModelWithObject, name: 'test2' })
  const reactive = watchVueAtom(atom)

  // Change deeply nested property
  reactive.config.settings.fontSize = 16
  await nextTick()

  t.equal(atom.state.config.settings.fontSize, 16, 'deeply nested property synced')
  t.end()
})

test('sync: replace entire object', async (t) => {
  const atom = Atom({ model: ModelWithObject, name: 'test3' })
  const reactive = watchVueAtom(atom)

  // Replace entire object
  reactive.user = { name: 'Alice', age: 25 }
  await nextTick()

  t.equal(atom.state.user.name, 'Alice', 'replaced object name synced')
  t.equal(atom.state.user.age, 25, 'replaced object age synced')
  t.end()
})

test('sync: object change from atom to vue', async (t) => {
  const atom = Atom({ model: ModelWithObject, name: 'test4' })
  const reactive = watchVueAtom(atom)

  // Change from atom side
  atom.core.user({ name: 'Bob', age: 40 })
  await nextTick()

  t.equal(reactive.user.name, 'Bob', 'atom change reflected in vue')
  t.equal(reactive.user.age, 40, 'atom change reflected in vue')
  t.end()
})

test('sync: array push', async (t) => {
  const atom = Atom({ model: ModelWithArray, name: 'test5' })
  const reactive = watchVueAtom(atom)

  // Push item
  reactive.items.push(4)
  await nextTick()

  t.equal(atom.state.items.length, 4, 'array length after push')
  t.equal(atom.state.items[3], 4, 'pushed item value')
  t.end()
})

test('sync: array splice', async (t) => {
  const atom = Atom({ model: ModelWithArray, name: 'test6' })
  const reactive = watchVueAtom(atom)

  // Remove first item
  reactive.items.splice(0, 1)
  await nextTick()

  t.equal(atom.state.items.length, 2, 'array length after splice')
  t.equal(atom.state.items[0], 2, 'first item after splice')
  t.end()
})

test('sync: array item property change', async (t) => {
  const atom = Atom({ model: ModelWithArray, name: 'test7' })
  const reactive = watchVueAtom(atom)

  // Change property of array item
  reactive.users[0].name = 'Alicia'
  await nextTick()

  t.equal(atom.state.users[0].name, 'Alicia', 'array item property synced')
  t.end()
})

test('sync: array replace', async (t) => {
  const atom = Atom({ model: ModelWithArray, name: 'test8' })
  const reactive = watchVueAtom(atom)

  // Replace entire array
  reactive.items = [10, 20, 30]
  await nextTick()

  t.equal(atom.state.items.length, 3, 'replaced array length')
  t.equal(atom.state.items[0], 10, 'replaced array first item')
  t.end()
})

test('sync: array unshift', async (t) => {
  const atom = Atom({ model: ModelWithArray, name: 'test9' })
  const reactive = watchVueAtom(atom)

  // Add item to beginning
  reactive.items.unshift(0)
  await nextTick()

  t.equal(atom.state.items.length, 4, 'array length after unshift')
  t.equal(atom.state.items[0], 0, 'first item after unshift')
  t.end()
})

test('sync: array pop', async (t) => {
  const atom = Atom({ model: ModelWithArray, name: 'test10' })
  const reactive = watchVueAtom(atom)

  // Remove last item
  const popped = reactive.items.pop()
  await nextTick()

  t.equal(popped, 3, 'popped value')
  t.equal(atom.state.items.length, 2, 'array length after pop')
  t.end()
})

test('sync: mixed primitives and complex types', async (t) => {
  const atom = Atom({ model: ModelMixed, name: 'test11' })
  const reactive = watchVueAtom(atom)

  // Change primitive
  reactive.count = 5
  await nextTick()
  t.equal(atom.state.count, 5, 'primitive synced')

  // Change array
  reactive.items.push(4)
  await nextTick()
  t.equal(atom.state.items.length, 4, 'array synced')

  // Change object
  reactive.user.name = 'Jane'
  await nextTick()
  t.equal(atom.state.user.name, 'Jane', 'object synced')

  t.end()
})

test('sync: bidirectional sync', async (t) => {
  const atom = Atom({ model: ModelWithObject, name: 'test12' })
  const reactive = watchVueAtom(atom)

  // Vue -> Atom
  reactive.user.name = 'Alice'
  await nextTick()
  t.equal(atom.state.user.name, 'Alice', 'vue to atom')

  // Atom -> Vue
  atom.core.user({ name: 'Bob', age: 50 })
  await nextTick()
  t.equal(reactive.user.name, 'Bob', 'atom to vue name')
  t.equal(reactive.user.age, 50, 'atom to vue age')

  // Vue -> Atom again
  reactive.user.age = 55
  await nextTick()
  t.equal(atom.state.user.age, 55, 'vue to atom again')

  t.end()
})

test('sync: no infinite loops with dedup', async (t) => {
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

  t.ok(atomUpdateCount <= 2, 'no infinite loop with dedup')
  t.end()
})

test('sync: array reverse', async (t) => {
  const atom = Atom({ model: ModelWithArray, name: 'test14' })
  const reactive = watchVueAtom(atom)

  reactive.items.reverse()
  await nextTick()

  t.equal(atom.state.items[0], 3, 'first item after reverse')
  t.equal(atom.state.items[2], 1, 'last item after reverse')
  t.end()
})

test('sync: array sort', async (t) => {
  const atom = Atom({ model: ModelWithArray, name: 'test15' })
  const reactive = watchVueAtom(atom)

  reactive.items = [3, 1, 2]
  await nextTick()

  reactive.items.sort()
  await nextTick()

  t.equal(atom.state.items[0], 1, 'first item after sort')
  t.equal(atom.state.items[2], 3, 'last item after sort')
  t.end()
})
