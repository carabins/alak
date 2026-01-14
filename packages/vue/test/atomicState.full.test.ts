/**
 * Полные тесты для AtomicStatePlugin
 * Проверяем все аспекты работы плагина: флаги Vue, реактивность, синхронизацию и т.д.
 */

import { test, expect } from 'bun:test'
import { Atom } from '@alaq/atom'
import { AtomicStatePlugin } from '../src/atomic-state'

test('AtomicStatePlugin: базовая функциональность', () => {
  const atom = Atom(
    { count: 0, name: 'test', flag: true },
    { plugins: [AtomicStatePlugin] }
  )

  // Проверяем, что atom создан
  expect(atom).toBeDefined()
  expect(atom.state).toBeDefined()

  // Проверяем, что state помечен как reactive
  expect((atom.state as any).__v_isReactive).toBe(true)
  expect((atom.state as any).__v_isReadonly).toBe(false)
  expect((atom.state as any).__v_isShallow).toBe(false)

  // Проверяем, что можно получить значения через state
  expect(atom.state.count).toBe(0)
  expect(atom.state.name).toBe('test')
  expect(atom.state.flag).toBe(true)

  // Проверяем, что можно изменить значения
  atom.state.count = 5
  atom.state.name = 'updated'
  atom.state.flag = false

  expect(atom.state.count).toBe(5)
  expect(atom.state.name).toBe('updated')
  expect(atom.state.flag).toBe(false)

  // Проверяем, что изменения отражаются в атоме
  expect(atom.core.count.value).toBe(5)
  expect(atom.core.name.value).toBe('updated')
  expect(atom.core.flag.value).toBe(false)
})

test('AtomicStatePlugin: синхронизация с atom.core', () => {
  const atom = Atom(
    { value: 10 },
    { plugins: [AtomicStatePlugin] }
  )

  // Изменяем значение через atom.core
  atom.core.value(42)

  // Проверяем, что изменение отразилось в state
  expect(atom.state.value).toBe(42)

  // Изменяем через state
  atom.state.value = 99

  // Проверяем, что изменение отразилось в atom.core
  expect(atom.core.value.value).toBe(99)
})

test('AtomicStatePlugin: работа с объектами', () => {
  const atom = Atom(
    { user: { name: 'John', age: 30 } },
    { plugins: [AtomicStatePlugin] }
  )

  // Проверяем, что объект возвращается корректно
  expect(atom.state.user).toEqual({ name: 'John', age: 30 })
  expect(atom.state.user.name).toBe('John')
  expect(atom.state.user.age).toBe(30)

  // Изменяем свойство объекта
  atom.state.user.name = 'Jane'

  // Проверяем, что изменение отразилось
  expect(atom.state.user.name).toBe('Jane')
  expect(atom.core.user.value.name).toBe('Jane')
})

test('AtomicStatePlugin: Vue reactivity integration', () => {
  const atom = Atom(
    { count: 0 },
    { plugins: [AtomicStatePlugin] }
  )

  // Проверяем, что можно получить исходное значение
  expect((atom.state as any).__v_raw).toBeDefined()
})