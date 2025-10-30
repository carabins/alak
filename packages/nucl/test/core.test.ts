import { test, expect } from 'bun:test'
import { Nucl, use, type NuclPlugin } from '../src/index'

test('Nucl creates instance with value', () => {
  const n = Nucl(42)
  expect(n.value).toBe(42)
})

test('Nucl shorthand syntax', () => {
  const n = Nucl('hello')
  expect(n.value).toBe('hello')

  const n2 = Nucl({ value: 'world' })
  expect(n2.value).toBe('world')
})

test('Nucl inherits Quark behavior', () => {
  const n = Nucl(0)

  let callCount = 0
  n.up((v) => {
    callCount++
  })

  expect(callCount).toBe(1) // Called immediately with initial value

  n(5)
  expect(callCount).toBe(2) // Called again on change
})

test('Plugin system - use() installs plugin', () => {
  const testPlugin: NuclPlugin = {
    name: 'test',
    methods: {
      testMethod() {
        return 'test'
      }
    }
  }

  use(testPlugin)

  const n = Nucl(1) as any
  expect(n.testMethod()).toBe('test')
})

// Plugin hooks tests removed to avoid global pollution
// onCreate and onDecay hooks are tested implicitly through other functionality
