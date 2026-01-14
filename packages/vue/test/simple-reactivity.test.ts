import { test, expect } from 'bun:test'
import { Atom } from '@alaq/atom'
import { AtomicStatePlugin } from '../src/atomic-state'
import { effect } from '@vue/reactivity'

test('simple reactivity test', () => {
  const atom = Atom(
    { count: 0 },
    { plugins: [AtomicStatePlugin] }
  )
  
  let renderCount = 0
  let value = 0
  
  effect(() => {
    renderCount++
    value = atom.state.count
  })
  
  // Initial state
  expect(renderCount).toBe(1)
  expect(value).toBe(0)
  
  // Update via state
  atom.state.count = 5
  expect(renderCount).toBe(2)  // Should be 2
  expect(value).toBe(5)
})