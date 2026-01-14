/**
 * Тесты для проверки двунаправленных обновлений между Vue template и atom state
 * Демонстрирует обновления в обоих направлениях: template -> atom и atom -> template
 */

import { test, expect } from 'bun:test'
import { Atom } from '@alaq/atom'
import { AtomicStatePlugin } from '../src/atomic-state'
import { effect } from '@vue/reactivity'

test('Bidirectional updates: template to atom', () => {
  const atom = Atom(
    { count: 0 },
    { plugins: [AtomicStatePlugin] }
  )
  
  // Имитация шаблона, который отображает и изменяет состояние
  let templateRenderCount = 0
  let displayedCount = 0
  
  effect(() => {
    templateRenderCount++
    displayedCount = atom.state.count
  })
  
  // Проверяем начальное состояние
  expect(templateRenderCount).toBe(1)
  expect(displayedCount).toBe(0)
  expect(atom.core.count.value).toBe(0)
  
  // Имитация изменения из "template" (например, пользователь нажимает кнопку)
  atom.state.count = 5
  expect(templateRenderCount).toBe(2) // шаблон обновился
  expect(displayedCount).toBe(5)
  expect(atom.core.count.value).toBe(5)
  
  // Еще одно изменение из "template"
  atom.state.count += 10
  expect(templateRenderCount).toBe(3)
  expect(displayedCount).toBe(15)
  expect(atom.core.count.value).toBe(15)
})

test('Bidirectional updates: atom to template', () => {
  const atom = Atom(
    { message: 'Initial' },
    { plugins: [AtomicStatePlugin] }
  )
  
  // Имитация шаблона, который отображает сообщение
  let templateRenderCount = 0
  let displayedMessage = ''
  
  effect(() => {
    templateRenderCount++
    displayedMessage = atom.state.message
  })
  
  // Проверяем начальное состояние
  expect(templateRenderCount).toBe(1)
  expect(displayedMessage).toBe('Initial')
  
  // Изменение из "атома" (например, из другого компонента или API)
  atom.core.message('Updated from atom')
  expect(templateRenderCount).toBe(2)
  expect(displayedMessage).toBe('Updated from atom')
  
  // Еще одно изменение из "атома"
  atom.core.message.value = 'Another update from atom'
  expect(templateRenderCount).toBe(3)
  expect(displayedMessage).toBe('Another update from atom')
})

test('Complex bidirectional updates with multiple properties', () => {
  const atom = Atom(
    { 
      user: { name: 'Vue User', age: 25 },
      isLoggedIn: false,
      preferences: { theme: 'light', lang: 'en' }
    },
    { plugins: [AtomicStatePlugin] }
  )
  
  // Имитация сложного шаблона с несколькими значениями
  let templateRenders = 0
  let templateState = {
    name: '',
    age: 0,
    isLoggedIn: false,
    theme: ''
  }
  
  effect(() => {
    templateRenders++
    templateState = {
      name: atom.state.user.name,
      age: atom.state.user.age,
      isLoggedIn: atom.state.isLoggedIn,
      theme: atom.state.preferences.theme
    }
  })
  
  // Проверяем начальное состояние
  expect(templateRenders).toBe(1)
  expect(templateState).toEqual({
    name: 'Vue User',
    age: 25,
    isLoggedIn: false,
    theme: 'light'
  })
  
  // Изменения из "template"
  atom.state.user.name = 'Updated Vue User'
  expect(templateRenders).toBe(2)
  expect(templateState.name).toBe('Updated Vue User')
  expect(atom.core.user.value.name).toBe('Updated Vue User')
  
  atom.state.isLoggedIn = true
  expect(templateRenders).toBe(3)
  expect(templateState.isLoggedIn).toBe(true)
  
  atom.state.preferences.theme = 'dark'
  expect(templateRenders).toBe(4)
  expect(templateState.theme).toBe('dark')
  
  // Изменения из "атома" (внешние изменения)
  atom.core.user({ name: 'Atom Updated User', age: 30 })
  expect(templateRenders).toBe(5)
  expect(templateState.name).toBe('Atom Updated User')
  expect(templateState.age).toBe(30)
  
  atom.core.isLoggedIn(false)
  expect(templateRenders).toBe(6)
  expect(templateState.isLoggedIn).toBe(false)
})

test('Bidirectional updates with nested object modifications', () => {
  const atom = Atom(
    {
      profile: {
        personal: {
          name: 'Vue Dev',
          contact: {
            email: 'dev@example.com',
            phone: '+1234567890'
          }
        },
        settings: {
          notifications: true,
          privacy: {
            showEmail: true,
            showPhone: false
          }
        }
      }
    },
    { plugins: [AtomicStatePlugin] }
  )
  
  // Имитация шаблона, отслеживающего глубокие изменения
  let renderCount = 0
  let templateData = {
    name: '',
    email: '',
    notifications: false,
    showEmail: false
  }
  
  effect(() => {
    renderCount++
    templateData = {
      name: atom.state.profile.personal.name,
      email: atom.state.profile.personal.contact.email,
      notifications: atom.state.profile.settings.notifications,
      showEmail: atom.state.profile.settings.privacy.showEmail
    }
  })
  
  // Проверяем начальное состояние
  expect(renderCount).toBe(1)
  expect(templateData).toEqual({
    name: 'Vue Dev',
    email: 'dev@example.com',
    notifications: true,
    showEmail: true
  })
  
  // Изменения из "template"
  atom.state.profile.personal.name = 'Updated Vue Dev'
  expect(renderCount).toBe(2)
  expect(templateData.name).toBe('Updated Vue Dev')
  
  atom.state.profile.personal.contact.email = 'updated@example.com'
  expect(renderCount).toBe(3)
  expect(templateData.email).toBe('updated@example.com')
  
  atom.state.profile.settings.privacy.showEmail = false
  expect(renderCount).toBe(4)
  expect(templateData.showEmail).toBe(false)
  
  // Изменения из "атома"
  atom.core.profile.value.personal.contact.phone = '+0987654321'
  // Обновление вложенного свойства, которое не отслеживается напрямую в effect,
  // не должно вызвать повторный рендер
  expect(renderCount).toBe(4) // тот же самый
  
  // Но изменение отслеживаемого свойства должно вызвать рендер
  atom.core.profile.value.settings.notifications = false
  expect(renderCount).toBe(5)
  expect(templateData.notifications).toBe(false)
})

test('Bidirectional updates with array state', () => {
  const atom = Atom(
    { 
      items: ['item1', 'item2', 'item3'],
      selected: []
    },
    { plugins: [AtomicStatePlugin] }
  )
  
  let renderCount = 0
  let templateItems = [] as string[]
  let templateSelected = [] as string[]
  
  effect(() => {
    renderCount++
    templateItems = [...atom.state.items]
    templateSelected = [...atom.state.selected]
  })
  
  // Проверяем начальное состояние
  expect(renderCount).toBe(1)
  expect(templateItems).toEqual(['item1', 'item2', 'item3'])
  expect(templateSelected).toEqual([])
  
  // Изменение из "template" - добавление элемента
  atom.state.items.push('item4')
  expect(renderCount).toBe(2)
  expect(templateItems).toEqual(['item1', 'item2', 'item3', 'item4'])
  
  // Изменение из "template" - выбор элемента
  atom.state.selected = ['item1', 'item3']
  expect(renderCount).toBe(3)
  expect(templateSelected).toEqual(['item1', 'item3'])
  
  // Изменение из "атома"
  atom.core.items(['new1', 'new2'])
  expect(renderCount).toBe(4)
  expect(templateItems).toEqual(['new1', 'new2'])
})

test('Template reactivity after direct atom.core changes', () => {
  const atom = Atom(
    { value: 'initial' },
    { plugins: [AtomicStatePlugin] }
  )
  
  let renderCount = 0
  let displayValue = ''
  
  effect(() => {
    renderCount++
    displayValue = atom.state.value
  })
  
  expect(renderCount).toBe(1)
  expect(displayValue).toBe('initial')
  
  // Изменяем через atom.core (минуя state)
  atom.core.value('changed via core')
  
  // Шаблон должен отреагировать на изменение
  expect(renderCount).toBe(2)
  expect(displayValue).toBe('changed via core')
  
  // Проверяем, что atom.state тоже обновился
  expect(atom.state.value).toBe('changed via core')
  
  // Теперь изменяем через atom.state
  atom.state.value = 'changed via state'
  
  expect(renderCount).toBe(3)
  expect(displayValue).toBe('changed via state')
  expect(atom.core.value.value).toBe('changed via state')
})