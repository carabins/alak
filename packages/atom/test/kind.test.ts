
import { describe, it, expect } from 'bun:test'
import { Atom, defineAtomKind } from '../src/atom'
import { AtomPlugin } from '../src/types'

describe('Atom v6 - Plugin Kinds', () => {
  it('should apply plugins from a named kind', () => {
    let pluginInitialized = false
    
    const testPlugin: AtomPlugin = {
      name: 'test-plugin',
      onInit(atom) {
        pluginInitialized = true
        // Add a marker to context
        atom.$.options.name = 'initialized-by-plugin'
      }
    }

    defineAtomKind('test-kind' as any, [testPlugin])

    const atom = Atom(class { a = 1 }, { kind: 'test-kind' as any })
    
    expect(pluginInitialized).toBe(true)
    expect(atom.$.options.name).toBe('initialized-by-plugin')
  })

  it('should merge multiple kinds from space-separated string', () => {
    const log: string[] = []
    
    const pluginA: AtomPlugin = {
      name: 'A',
      onInit() { log.push('A') }
    }
    const pluginB: AtomPlugin = {
      name: 'B',
      onInit() { log.push('B') }
    }

    defineAtomKind('kindA' as any, [pluginA])
    defineAtomKind('kindB' as any, [pluginB])

    Atom(class { a = 1 }, { kind: 'kindA kindB' as any })
    
    expect(log).toContain('A')
    expect(log).toContain('B')
    expect(log.length).toBe(2)
  })

  it('should fallback to default plugins if kind is not found', () => {
    // This assumes ComputedPlugin is a default plugin
    const atom = Atom(class {
      a = 1
      get b() { return this.a + 1 }
    }, { kind: 'non-existent' as any })

    expect(atom.b).toBe(2)
    atom.a = 5
    expect(atom.b).toBe(6) // Computed works, so default plugins were applied
  })
})
