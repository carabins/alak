/**
 * Тест для проверки NuclRefPlugin
 * Проверяем, что плагин делает Nucl объекты похожими на Vue Ref
 */

import { test, expect } from 'bun:test'
import { Nucl, use } from '@alaq/nucl'
import { NuclRefPlugin } from '../src/nucleus'

test('NuclRefPlugin should make Nucl instances behave like Vue refs', () => {
  // Устанавливаем плагин
  use(NuclRefPlugin)

  // Создаем Nucl
  const count = Nucl(0)

  // Проверяем, что установлены маркеры Vue ref
  expect(count.__v_isRef).toBe(true)
  expect(count.__v_isShallow).toBe(false)

  // Проверяем, что можно получить значение через .value
  expect(count.value).toBe(0)

  // Проверяем, что можно изменить значение
  count.value = 5
  expect(count.value).toBe(5)

  // Проверяем, что значение также обновилось внутри nucl
  expect((count as any)._originalValue).toBe(5)
})

test('NuclRefPlugin should prevent infinite loops during synchronization', () => {
  use(NuclRefPlugin)

  const testValue = Nucl('initial')

  // Изменяем значение извне (например, из Vue компонента)
  testValue.value = 'updated'

  // Проверяем, что значение обновилось в обоих местах
  expect(testValue.value).toBe('updated')
  expect((testValue as any)._originalValue).toBe('updated')
})

test('NuclRefPlugin should handle changes from Nucl side correctly', () => {
  use(NuclRefPlugin)

  const testValue = Nucl('initial')

  // Изменяем значение через Nucl
  testValue('fromNucl')

  // Проверяем, что значение обновилось в обоих местах
  expect(testValue.value).toBe('fromNucl')
  expect((testValue as any)._originalValue).toBe('fromNucl')
})
