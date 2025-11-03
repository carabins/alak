import { test, expect } from 'bun:test'
import { Nucleus } from '../src/nucleus'

// ============ UNIVERSAL ============

test('isEmpty - string', () => {
  const n = Nucleus('') as any
  expect(n.isEmpty).toBe(true)

  n('hello')
  expect(n.isEmpty).toBe(false)
})

test('isEmpty - array', () => {
  const n = Nucleus([]) as any
  expect(n.isEmpty).toBe(true)

  n([1, 2])
  expect(n.isEmpty).toBe(false)
})

test('isEmpty - object', () => {
  const n = Nucleus({}) as any
  expect(n.isEmpty).toBe(true)

  n({ x: 1 })
  expect(n.isEmpty).toBe(false)
})

test('upSome - only triggers on truthy', () => {
  const n = Nucleus(0) as any
  let count = 0

  n.upSome(() => count++)

  n(0)   // no trigger
  n(5)   // trigger
  n(10)  // trigger
  n(0)   // no trigger

  expect(count).toBe(2)
})

test('injectTo', () => {
  const n = Nucleus(42) as any
  n.id = 'count' // Set id property
  const obj: any = {}

  n.injectTo(obj)

  expect(obj.count).toBe(42)

  obj.count = 100
  expect(n.value).toBe(100)
})

test('injectAs', () => {
  const n = Nucleus('hello') as any
  const obj: any = {}

  n.injectAs('greeting', obj)

  expect(obj.greeting).toBe('hello')

  obj.greeting = 'world'
  expect(n.value).toBe('world')
})

// ============ ARRAY ============

test('push', () => {
  const n = Nucleus([1, 2, 3]) as any

  n.push(4)
  expect(n.value).toEqual([1, 2, 3, 4])

  n.push(5, 6)
  expect(n.value).toEqual([1, 2, 3, 4, 5, 6])
})

test('pop', () => {
  const n = Nucleus([1, 2, 3]) as any

  const last = n.pop()
  expect(last).toBe(3)
  expect(n.value).toEqual([1, 2])
})

test('find', () => {
  const n = Nucleus([1, 2, 3, 4]) as any

  const found = n.find((x: number) => x > 2)
  expect(found).toBe(3)
})

test('at', () => {
  const n = Nucleus(['a', 'b', 'c']) as any

  expect(n.at(0)).toBe('a')
  expect(n.at(-1)).toBe('c')
  expect(n.at(10)).toBeUndefined()
})

test('size getter', () => {
  const n = Nucleus([1, 2, 3]) as any

  expect(n.size).toBe(3)

  n.push(4)
  expect(n.size).toBe(4)
})

// ============ OBJECT ============

test('set', () => {
  const n = Nucleus({ x: 1, y: 2 }) as any

  n.set('x', 10)
  expect(n.value).toEqual({ x: 10, y: 2 })

  n.set('z', 3)
  expect(n.value).toEqual({ x: 10, y: 2, z: 3 })
})

test('get', () => {
  const n = Nucleus({ name: 'John', age: 30 }) as any

  expect(n.get('name')).toBe('John')
  expect(n.get('age')).toBe(30)
})

test('pick - returns plain object', () => {
  const n = Nucleus({ a: 1, b: 2, c: 3 }) as any
  const picked = n.pick('a', 'c')

  expect(picked).toEqual({ a: 1, c: 3 })
})

test('keys getter', () => {
  const n = Nucleus({ x: 1, y: 2 }) as any

  expect(n.keys).toEqual(['x', 'y'])
})

test('values getter', () => {
  const n = Nucleus({ x: 1, y: 2 }) as any

  expect(n.values).toEqual([1, 2])
})
