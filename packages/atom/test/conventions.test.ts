
import { describe, it, expect } from 'bun:test'
import { Atom } from '../src/atom'
import { ConventionsPlugin } from '../src/plugins/conventions'
import { quantumBus } from '@alaq/quark/quantum-bus'

class ConventionsModel {
  count = 0
  
  _count_up(val: number) {
    console.log(`_count_up: ${val}`)
  }

  _on_TEST_EVENT(payload: any) {
    console.log(`_on_TEST_EVENT: ${payload.data}`)
  }
}

describe('Atom v6 - Conventions', () => {
  it('should auto-wire _prop_up methods', () => {
    const log: string[] = []
    
    // Mock console.log
    const originalLog = console.log
    console.log = (msg: string) => log.push(msg)
    
    const atom = Atom(ConventionsModel)
    
    atom.count = 10
    expect(log).toContain('_count_up: 10')
    
    console.log = originalLog
  })

  it('should auto-wire _on_EVENT methods', () => {
    const log: string[] = []
    const originalLog = console.log
    console.log = (msg: string) => log.push(msg)

    const atom = Atom(ConventionsModel, { realm: 'test-conventions' })
    const bus = quantumBus.getRealm('test-conventions')
    
    bus.emit('TEST_EVENT', 'hello')
    
    expect(log).toContain('_on_TEST_EVENT: hello')
    
    console.log = originalLog
  })

  it('should support emitChanges option', () => {
    // This functionality is tested in failing_events.test.ts due to CI instability
  })
})
