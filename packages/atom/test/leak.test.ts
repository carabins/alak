import { describe, it, expect } from 'bun:test'
import { Atom } from '../src/atom'
import { quantumBus } from '@alaq/quark/quantum-bus'

class LeakyModel {
  _on_ping() {}
}

describe('Atom v6 - Memory Leaks', () => {
  it('should clean up bus listeners on decay', () => {
    const realmName = 'leak-test-' + Math.random()
    const bus = quantumBus.getRealm(realmName)
    
    // 1. Create Atom
    const atom = Atom(LeakyModel, { realm: realmName })
    
    // Check listener count
    // Accessing private _events via any cast for testing
    const events = (bus as any)._events
    expect(events.get('ping')?.size).toBe(1)
    
    // 2. Decay
    atom.$.decay()
    
    // 3. Listener should be gone
    // Current implementation: THIS WILL FAIL
    const listeners = events.get('ping')
    const count = listeners ? listeners.size : 0
    expect(count).toBe(0)
  })
})
