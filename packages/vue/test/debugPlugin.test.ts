import { test, expect } from 'bun:test'
import { Atom } from '@alaq/atom'

// Создадим тестовый плагин для проверки, вызываются ли плагины
const testPlugin = {
  symbol: Symbol('test'),
  wrapState(originalState: any, atom: any) {
    console.log('Test plugin wrapState called')
    return originalState
  }
}

test('Проверка вызова плагинов', () => {
  console.log('Creating atom with test plugin...')
  const atom = Atom(
    { count: 0 },  // model
    { plugins: [testPlugin] }  // options
  )
  console.log('Atom created')
  expect(atom).toBeDefined()
})