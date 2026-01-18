import { test, expect, mock } from 'bun:test'
import { createState } from '../src/index'
import { isGhost, GHOST_SYMBOL } from '../src/ghost'

test('Ghost: should return undefined when disabled (default)', () => {
  const state = createState(() => {})
  const proxy = state.deepWatch({})
  
  expect(proxy.missing).toBeUndefined()
})

test('Ghost: should return Proxy when enabled', () => {
  const onGhost = mock((path) => {})
  const state = createState(() => {}, { ghosts: true, onGhost })
  const proxy = state.deepWatch({ exists: 1 })
  
  // 1. Access existing
  expect(proxy.exists).toBe(1)
  expect(onGhost).not.toHaveBeenCalled()
  
  // 2. Access missing
  const ghost = proxy.missing
  expect(ghost).toBeDefined()
  expect(isGhost(ghost)).toBe(true)
  expect(onGhost).toHaveBeenCalledWith('missing')
})

test('Ghost: should handle nested navigation', () => {
  const onGhost = mock((path) => {})
  const state = createState(() => {}, { ghosts: true, onGhost })
  const proxy = state.deepWatch({})
  
  // proxy.user (Ghost) -> .profile (Ghost) -> .name (Ghost)
  // onGhost triggers ONLY for 'user' (transition from Real to Ghost)
  // Subsequent access is internal to Ghost world
  
  const name = proxy.user.profile.name
  
  expect(isGhost(name)).toBe(true)
  expect(onGhost).toHaveBeenCalledTimes(1)
  expect(onGhost).toHaveBeenCalledWith('user')
})

test('Ghost: safe primitives', () => {
  const state = createState(() => {}, { ghosts: true })
  const proxy = state.deepWatch({})
  const ghost = proxy.missing
  
  // Should behave like falsy/empty in most contexts
  expect(String(ghost)).toBe('undefined')
  expect(Number(ghost)).toBe(NaN)
  expect(JSON.stringify(ghost)).toBe(undefined)
  
  // Logic checks
  if (ghost) {
    // Ghosts are objects, so they are truthy in JS!
    // This is unavoidable without Proxy breaking spec.
    // User must check if (isGhost(val)) or rely on UI handling.
  }
})

test('Ghost: mixed with real data', () => {
  const state = createState(() => {}, { ghosts: true })
  const proxy = state.deepWatch({
    user: {
      name: 'Alice'
    }
  })
  
  // Real
  expect(proxy.user.name).toBe('Alice')
  
  // Ghost
  const age = proxy.user.age
  expect(isGhost(age)).toBe(true)
})
