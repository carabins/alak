/**
 * Тест для изучения структуры atom
 */

import { test, expect } from 'bun:test'
import { Atom } from '@alaq/atom'

const debugPlugin = {
  symbol: Symbol('debug'),
  wrapState(originalState: any, atom: any) {
    console.log('atom keys:', Object.keys(atom))
    console.log('atom._internal keys:', Object.keys(atom._internal))
    console.log('Properties:', atom._internal.properties)
    console.log('Computed:', atom._internal.computed)
    console.log('Core:', atom.core)
    console.log('Original state keys:', Reflect.ownKeys(originalState))
    console.log('prop1 in originalState?', 'prop1' in originalState)
    console.log('prop2 in originalState?', 'prop2' in originalState)
    return originalState
  }
}

test('Изучение структуры atom', () => {
  const atom = Atom(
    { prop1: 'value1', prop2: 'value2' },
    { plugins: [debugPlugin] }
  )
  expect(atom).toBeDefined()
})