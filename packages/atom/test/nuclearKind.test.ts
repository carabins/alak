import { describe, it, expect, spyOn } from 'bun:test'
import { Atom } from '../src/atom'
import { kind } from '../src/orbit'
import { defineKind } from '@alaq/nucl'

// Регистрируем тестовые "кинды" в Nucl, чтобы проверить их наличие
let lastAppliedKind = ''
defineKind('test-global', {
  onCreate: () => { lastAppliedKind += '[global]' }
})
defineKind('test-local', {
  onCreate: () => { lastAppliedKind += '[local]' }
})

class NuclearModel {
  raw = 1
  explicit = kind('test-local', 2)
  clash = kind('test-global', 3)
}

describe('Atom v6 - Nuclear Kind', () => {
  it('should apply global nuclearKind to raw properties', () => {
    lastAppliedKind = ''
    Atom(NuclearModel, { nuclearKind: 'test-global' })
    
    // raw property should have [global]
    expect(lastAppliedKind).toContain('[global]')
  })

  it('should merge global and local kinds', () => {
    lastAppliedKind = ''
    Atom(NuclearModel, { nuclearKind: 'test-global' })
    
    // explicit property should have both [global] and [local]
    expect(lastAppliedKind).toContain('[global]')
    expect(lastAppliedKind).toContain('[local]')
  })

  it('should warn on duplicate kinds and deduplicate them', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})
    
    lastAppliedKind = ''
    Atom(NuclearModel, { nuclearKind: 'test-global' })
    
    // 'clash' property has test-global and global option is test-global
    expect(warnSpy).toHaveBeenCalled()
    
    // Resulting kind should be deduplicated (only one [global] for the clash property)
    // Counting occurrences: 1 for 'raw', 1 for 'explicit', 1 for 'clash' = 3 total [global]
    const matches = lastAppliedKind.match(/\[global\]/g)
    expect(matches?.length).toBe(3)
    
    warnSpy.mockRestore()
  })
})
