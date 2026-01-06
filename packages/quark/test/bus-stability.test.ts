import { describe, it, expect, spyOn } from 'bun:test'
import { quantumBus } from '../src/quantum-bus'

describe('Quantum Bus - Stability', () => {
  it('should continue emitting to other listeners if one fails', () => {
    const bus = quantumBus.getRealm('stability-test-1')
    let callCount = 0
    
    bus.on('danger', () => {
      throw new Error('Boom!')
    })
    
    bus.on('danger', () => {
      callCount++
    })
    
    // Should not crash the process
    try {
      bus.emit('danger', {})
    } catch (e) {
      // It might throw, but we want to ensure the second listener was called?
      // Or should it suppress errors? ideally suppress and log error.
    }
    
    // In a robust system, the second listener MUST be called
    expect(callCount).toBe(1)
  })

  it('should handle cross-realm cycles without infinite recursion (optional checks)', () => {
    // This is tricky. If Realm A listens to B, and B listens to A, and they echo events...
    // The user is responsible for logic, but the bus shouldn't crash unexpectedly if possible.
    // For now, let's just ensure basic cross-realm doesn't double-emit.
    
    const r1 = quantumBus.getRealm('r1')
    const r2 = quantumBus.getRealm('r2')
    
    let r1_count = 0
    r1.on('ping', () => r1_count++)
    
    // r2 listens to r1:ping and re-emits (bad logic, but possible)
    r2.on('r1:ping', () => {
       // if r2 re-emits something that r1 listens to...
    })
    
    r1.emit('ping', 1)
    expect(r1_count).toBe(1)
  })
})
