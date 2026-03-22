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
    const listeners = events.get('ping')
    const count = listeners ? listeners.size : 0
    expect(count).toBe(0)
  })

  it('should clean up property listeners (_up) on decay', () => {
    class UpModel {
      count = 0
      _count_up() {}
    }
    
    const atom = Atom(UpModel)
    const nucl = atom.$count
    
    // Nucl edges are listeners
    expect((nucl as any)._edges?.length).toBe(1)
    
    atom.$.decay()
    
    // After decay, it should be null
    expect((nucl as any)._edges).toBeNull()
  })
})
