
import { describe, it, expect } from 'bun:test'
import { quantumBus } from '../src/quantum-bus'

describe('Quantum Bus Scopes', () => {
  it('should bubble events up the scope hierarchy', () => {
    const realm = quantumBus.getRealm('scope-test')
    const logs: string[] = []

    // Listeners
    realm.on('CHANGE', () => logs.push('global'))
    realm.onScope('user', 'CHANGE', () => logs.push('user'))
    realm.onScope('user.1', 'CHANGE', () => logs.push('user.1'))
    realm.onScope('user.1.name', 'CHANGE', () => logs.push('user.1.name'))

    // Emit deep
    realm.emitInScope('user.1.name', 'CHANGE', 123)

    expect(logs).toContain('user.1.name')
    expect(logs).toContain('user.1')
    expect(logs).toContain('user')
    expect(logs).toContain('global')
    expect(logs.length).toBe(4)
  })

  it('should not leak events to unrelated scopes', () => {
    const realm = quantumBus.getRealm('scope-isolation')
    const logs: string[] = []

    realm.onScope('user.2', 'CHANGE', () => logs.push('user.2'))

    // Emit to sibling scope
    realm.emitInScope('user.1', 'CHANGE', 123)

    expect(logs).toHaveLength(0)
  })
})
