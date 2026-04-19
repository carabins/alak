import { test, expect, mock } from 'bun:test'
import { bindProps } from '../src/core/bind'
import { Qv } from '@alaq/quark'

class MockDisplayObject {
  x = 0
  alpha = 1
  listeners = new Map<string, Function[]>()

  once(event: string, fn: Function) {
    if (!this.listeners.has(event)) this.listeners.set(event, [])
    this.listeners.get(event)!.push(fn)
  }

  destroy() {
    this.listeners.get('destroy')?.forEach(fn => fn())
  }
}

test('bindProps: Static', () => {
  const obj = new MockDisplayObject()
  bindProps(obj, { x: 100 })
  expect(obj.x).toBe(100)
})

test('bindProps: Reactive', () => {
  const obj = new MockDisplayObject()
  const q = Qv(0.5)
  
  bindProps(obj, { alpha: q })
  
  // Initial value (up called immediately)
  expect(obj.alpha).toBe(0.5)
  
  // Update
  q(0.8)
  expect(obj.alpha).toBe(0.8)
})

test('bindProps: Cleanup on destroy', () => {
  const obj = new MockDisplayObject()
  const q = Qv(10)
  
  bindProps(obj, { x: q })
  
  // Destroy object
  obj.destroy()
  
  // Update quark
  q(20)
  
  // Object should NOT update
  expect(obj.x).toBe(10)
})
