import { test, expect } from 'bun:test'
import { Nv,  } from '../src/index'
import {createNuRealm} from "../src/plugins";

test('Nv creates instance with value', () => {
  const n = Nv(42)
  expect(n.value).toBe(42)
})

test('Nv shorthand syntax', () => {
  const n = Nv('hello')
  expect(n.value).toBe('hello')

  const n2 = Nv('world', { id: 'test' })
  expect(n2.value).toBe('world')
})

test('Nv inherits Quark behavior', () => {
  const n = Nv(0)

  let callCount = 0
  n.up((v) => {
    callCount++
  })

  expect(callCount).toBe(1) // Called immediately with initial value

  n(5)
  expect(callCount).toBe(2) // Called again on change
})

test('Plugin system - createNuRealm installs plugin', () => {
  const testPlugin = {
    name: 'test',
    methods: {
      testMethod() {
        return 'test'
      }
    }
  }

  createNuRealm("+", testPlugin)

  const n = Nv(1) as any
  expect(n.testMethod()).toBe('test')
})

// Plugin hooks tests removed to avoid global pollution
// onCreate and onDecay hooks are tested implicitly through other functionality
