/**
 * Test std (Standard) Kind API
 */

import { test, expect } from 'bun:test'
import { Nu } from '../src/index'
import { stdPlugin } from '../src/std/plugin'
import { createDeepPlugin } from '../src/deep-state/plugin'

// Use plugins option directly to avoid registry confusion in tests

// ============ UNIVERSAL ============

test('std: isEmpty - string', () => {
  const n = Nu({ value: '', plugins: [stdPlugin] }) as any
  expect(n.isEmpty).toBe(true)

  n('hello')
  expect(n.isEmpty).toBe(false)
})

test('std: isEmpty - array', () => {
  const n = Nu({ value: [], plugins: [stdPlugin] }) as any
  expect(n.isEmpty).toBe(true)

  n([1, 2])
  expect(n.isEmpty).toBe(false)
})

test('std: isEmpty - object', () => {
  const n = Nu({ value: {}, plugins: [stdPlugin] }) as any
  expect(n.isEmpty).toBe(true)

  n({ x: 1 })
  expect(n.isEmpty).toBe(false)
})

test('std: upSome - only triggers on truthy', () => {
  const n = Nu({ value: 0, plugins: [stdPlugin] }) as any
  let count = 0

  n.upSome(() => count++)

  n(0)   // no trigger
  n(5)   // trigger
  n(10)  // trigger
  n(0)   // no trigger

  expect(count).toBe(2)
})

test('std: injectTo', () => {
  const n = Nu({ value: 42, id: 'count', plugins: [stdPlugin] }) as any
  const obj: any = {}

  n.injectTo(obj)

  expect(obj.count).toBe(42)

  obj.count = 100
  expect(n.value).toBe(100)
})

test('std: injectAs', () => {
  const n = Nu({ value: 'hello', plugins: [stdPlugin] }) as any
  const obj: any = {}

  n.injectAs('greeting', obj)

  expect(obj.greeting).toBe('hello')

  obj.greeting = 'world'
  expect(n.value).toBe('world')
})

// ============ ARRAY ============

test('std: push', () => {
  const n = Nu({ value: [1, 2, 3], plugins: [stdPlugin] }) as any

  n.push(4)
  expect(n.value).toEqual([1, 2, 3, 4])

  n.push(5, 6)
  expect(n.value).toEqual([1, 2, 3, 4, 5, 6])
})

test('std: pop', () => {
  const n = Nu({ value: [1, 2, 3], plugins: [stdPlugin] }) as any

  const last = n.pop()
  expect(last).toBe(3)
  expect(n.value).toEqual([1, 2])
})

test('std: find', () => {
  const n = Nu({ value: [1, 2, 3, 4], plugins: [stdPlugin] }) as any

  const found = n.find((x: number) => x > 2)
  expect(found).toBe(3)
})

test('std: at', () => {
  const n = Nu({ value: ['a', 'b', 'c'], plugins: [stdPlugin] }) as any

  expect(n.at(0)).toBe('a')
  expect(n.at(-1)).toBe('c')
  expect(n.at(10)).toBeUndefined()
})

test('std: size getter', () => {
  const n = Nu({ value: [1, 2, 3], plugins: [stdPlugin] }) as any

  expect(n.size).toBe(3)

  n.push(4)
  expect(n.size).toBe(4)
})

// ============ OBJECT ============

test('std: set', () => {
  const n = Nu({ value: { x: 1, y: 2 }, plugins: [stdPlugin] }) as any

  n.set('x', 10)
  expect(n.value).toEqual({ x: 10, y: 2 })

  n.set('z', 3)
  expect(n.value).toEqual({ x: 10, y: 2, z: 3 })
})

test('std: get', () => {
  const n = Nu({ value: { name: 'John', age: 30 }, plugins: [stdPlugin] }) as any

  expect(n.get('name')).toBe('John')
  expect(n.get('age')).toBe(30)
})

test('std: pick - returns plain object', () => {
  const n = Nu({ value: { a: 1, b: 2, c: 3 }, plugins: [stdPlugin] }) as any
  const picked = n.pick('a', 'c')

  expect(picked).toEqual({ a: 1, c: 3 })
})

test('std: keys getter', () => {
  const n = Nu({ value: { x: 1, y: 2 }, plugins: [stdPlugin] }) as any

  expect(n.keys).toEqual(['x', 'y'])
})

test('std: values getter', () => {
  const n = Nu({ value: { x: 1, y: 2 }, plugins: [stdPlugin] }) as any

  expect(n.values).toEqual([1, 2])
})

// ============ COMBINED deep state ============

test('std deep: array with deep state', () => {
  const n = Nu({ value: [ { id: 1 } ], plugins: [stdPlugin, createDeepPlugin()] }) as any
  let updateCount = 0
  n.up(() => updateCount++)

  expect(updateCount).toBe(1) // initial
  
  n.value[0].id = 2
  expect(updateCount).toBe(2)
  expect(n.value[0].id).toBe(2)
})

test('std deep: object with deep state', () => {
  const n = Nu({ value: { a: { b: 1 } }, plugins: [stdPlugin, createDeepPlugin()] }) as any
  let updateCount = 0
  n.up(() => updateCount++)

  expect(updateCount).toBe(1) // initial
  
  n.value.a.b = 2
  expect(updateCount).toBe(2)
  expect(n.value.a.b).toBe(2)
})
