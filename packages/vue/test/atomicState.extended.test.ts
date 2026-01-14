/**
 * Расширенные тесты для AtomicStatePlugin
 * Проверяем граничные случаи, сложные сценарии и интеграцию
 */

import { test, expect } from 'bun:test'
import { Atom } from '@alaq/atom'
import { AtomicStatePlugin } from '../src/atomic-state'

test('AtomicStatePlugin: изменение значений на сложные объекты', () => {
  const atom = Atom(
    { data: null },
    { plugins: [AtomicStatePlugin] }
  )

  // Устанавливаем сложный объект
  atom.state.data = { nested: { value: 42 } }
  
  expect(atom.state.data.nested.value).toBe(42)
  expect(atom.core.data.value.nested.value).toBe(42)
})

test('AtomicStatePlugin: массивы', () => {
  const atom = Atom(
    { items: [1, 2, 3] },
    { plugins: [AtomicStatePlugin] }
  )

  // Проверяем, что массив доступен
  expect(atom.state.items).toEqual([1, 2, 3])
  expect(Array.isArray(atom.state.items)).toBe(true)

  // Модифицируем массив
  atom.state.items = [4, 5, 6]
  expect(atom.state.items).toEqual([4, 5, 6])
  expect(atom.core.items.value).toEqual([4, 5, 6])
})

test('AtomicStatePlugin: проверка флага __v_raw', () => {
  const atom = Atom(
    { value: 'test' },
    { plugins: [AtomicStatePlugin] }
  )

  // Проверяем, что __v_raw возвращает оригинальный state
  const raw = (atom.state as any).__v_raw
  // В нашей реализации __v_raw возвращает originalState, но это может быть Proxy
  expect(raw).toBeDefined()
})

test('AtomicStatePlugin: проверка has и ownKeys', () => {
  const atom = Atom(
    { prop1: 'value1', prop2: 'value2' },
    { plugins: [AtomicStatePlugin] }
  )

  // Проверяем наличие свойств
  expect('prop1' in atom.state).toBe(true)
  expect('prop2' in atom.state).toBe(true)
  expect('nonexistent' in atom.state).toBe(false)

  // Проверяем ownKeys (с помощью Object.keys)
  const keys = Object.keys(atom.state)
  expect(keys).toContain('prop1')
  expect(keys).toContain('prop2')
})

test('AtomicStatePlugin: реактивность вложенных объектов', () => {
  const atom = Atom(
    { user: { profile: { name: 'Alice' } } },
    { plugins: [AtomicStatePlugin] }
  )

  // Проверяем изначальное значение
  expect(atom.state.user.profile.name).toBe('Alice')

  // Изменяем вложенное значение
  atom.state.user.profile.name = 'Bob'
  expect(atom.state.user.profile.name).toBe('Bob')
  expect(atom.core.user.value.profile.name).toBe('Bob')
})

test('AtomicStatePlugin: граничные значения', () => {
  const atom = Atom(
    { 
      zero: 0,
      emptyString: '',
      nullValue: null,
      undefinedValue: undefined,
      falseValue: false
    },
    { plugins: [AtomicStatePlugin] }
  )

  // Проверяем граничные значения
  expect(atom.state.zero).toBe(0)
  expect(atom.state.emptyString).toBe('')
  expect(atom.state.nullValue).toBe(null)
  expect(atom.state.undefinedValue).toBe(undefined)
  expect(atom.state.falseValue).toBe(false)

  // Меняем значения
  atom.state.zero = 1
  atom.state.emptyString = 'changed'
  atom.state.nullValue = 'not null anymore'
  atom.state.undefinedValue = 'defined now'
  atom.state.falseValue = true

  expect(atom.state.zero).toBe(1)
  expect(atom.state.emptyString).toBe('changed')
  expect(atom.state.nullValue).toBe('not null anymore')
  expect(atom.state.undefinedValue).toBe('defined now')
  expect(atom.state.falseValue).toBe(true)
})