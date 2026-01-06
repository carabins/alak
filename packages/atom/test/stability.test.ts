import { describe, it, expect } from 'bun:test'
import { Atom } from '../src/atom'

class Counter {
  count = 0
  inc() { this.count++ }
}

describe('Atom v6 - Stability & Performance', () => {
  it('should maintain stable method references', () => {
    const atom = Atom(Counter)
    
    const method1 = atom.inc
    const method2 = atom.inc
    
    // Without caching, these would be different (new bound functions)
    expect(method1).toBe(method2)
  })

  it('should maintain method functionality after binding', () => {
    const atom = Atom(Counter)
    const inc = atom.inc
    
    inc()
    expect(atom.count).toBe(1)
  })
})
