import { describe, it, expect } from 'bun:test'
import { Atom } from '../src/atom'
import { kind } from '../src/orbit'

class CounterModel {
  count = 0
  name = "Counter"
  
  // Dynamic property placeholder
  dynamic: number

  constructor(start: number = 0) {
    this.count = start
    // Dynamic property initialization
    this.dynamic = 100
  }

  inc() {
    this.count++
  }

  setName(n: string) {
    this.name = n
  }
}

describe('Atom v6 - Basic', () => {
  it('should initialize state from class properties', () => {
    const atom = Atom(CounterModel)
    expect(atom.count).toBe(0)
    expect(atom.name).toBe("Counter")
  })

  it('should accept constructor arguments', () => {
    const atom = Atom(CounterModel, { constructorArgs: [10] })
    expect(atom.count).toBe(10)
  })

  it('should handle dynamic properties from constructor', () => {
    const atom = Atom(CounterModel)
    expect(atom.dynamic).toBe(100)
    
    // Check if it became a Nucl
    expect(atom.$dynamic).toBeDefined()
    atom.dynamic = 200
    expect(atom.dynamic).toBe(200)
  })

  it('should update state via actions (proxy mutation)', () => {
    const atom = Atom(CounterModel)
    atom.inc()
    expect(atom.count).toBe(1)
    atom.inc()
    expect(atom.count).toBe(2)
  })

  it('should access Nucleus instance via $', () => {
    const atom = Atom(CounterModel)
    const nucl = atom.$count
    
    expect(nucl).toBeDefined()
    expect(nucl.value).toBe(0)
    
    // Update via Nucl
    nucl(50)
    expect(atom.count).toBe(50)
  })

  it('should respect Orbit configuration', () => {
    class ConfigModel {
      // Explicit orbit
      special = kind('nucleus', 'foo', { meta: 'data' })
    }
    
    const atom = Atom(ConfigModel)
    expect(atom.special).toBe('foo')
    expect(atom.$special).toBeDefined()
  })
})
