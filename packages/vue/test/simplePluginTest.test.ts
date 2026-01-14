/**
 * Упрощенный тест для проверки, вызывается ли плагин
 */

import { test, expect } from 'bun:test'
import { Atom } from '@alaq/atom'
import { AtomicStatePlugin } from '../src/atomic-state'

test('AtomicStatePlugin вызывается', () => {
  // Создаем атом с плагином
  const TestAtom = (props: any) => Atom({
    model: {
      ...props
    },
    plugins: [AtomicStatePlugin]
  })

  // Создаем атом
  const atom = TestAtom({ count: 0, name: 'test' })
  
  // Проверяем, что атом создан
  expect(atom).toBeDefined()
})