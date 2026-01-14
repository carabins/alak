/**
 * Тест для проверки AtomicStatePlugin
 * Проверяем, что плагин делает atom.state похожим на Vue reactive
 */

import { test, expect } from 'bun:test'
import { Atom } from '@alaq/atom'
import { AtomicStatePlugin } from '../src/atomic-state'

test('AtomicStatePlugin should make atom.state behave like Vue reactive', () => {
  // Проверяем, что плагин экспортируется
  expect(AtomicStatePlugin).toBeDefined()
  
  // Создаем атом с плагином
  const atom = Atom(
    { count: 0, name: 'test' },  // model
    { plugins: [AtomicStatePlugin] }  // options
  )
  
  // Проверяем, что атом создан
  expect(atom).toBeDefined()
  expect(atom.state).toBeDefined()
  
  // Проверяем, что state помечен как reactive
  expect((atom.state as any).__v_isReactive).toBe(true)
  
  // Проверяем, что можно получить значения через state
  expect(atom.state.count).toBe(0)
  expect(atom.state.name).toBe('test')
  
  // Проверяем, что можно изменить значения
  atom.state.count = 5
  expect(atom.state.count).toBe(5)
  
  atom.state.name = 'updated'
  expect(atom.state.name).toBe('updated')
  
  // Проверяем, что изменения отражаются в атоме
  expect(atom.core.count.value).toBe(5)
  expect(atom.core.name.value).toBe('updated')
})