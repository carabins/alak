/**
 * Тесты для проверки реактивности шаблона Vue с AtomicStatePlugin
 * Демонстрирует реактивность между atom state и Vue template
 */

import { test, expect } from 'bun:test'
import { Atom } from '@alaq/atom'
import { AtomicStatePlugin } from '../src/atomic-state'
import { deepWatchPlugin, getDeep, setDeep } from '@alaq/nucl/deep-watch'
import { effect, reactive, computed } from '@vue/reactivity'

test('Reactivity from atom state to Vue template', () => {
  const atom = Atom(
    { msg: 'Hello World!' },
    { plugins: [AtomicStatePlugin] }
  )
  
  // Это имитирует реактивность Vue template
  // В шаблоне Vue отслеживается состояние и перерендеривается при изменениях
  let templateRenderCount = 0
  let renderedMsg = ''
  
  // Используем effect как Vue делает внутренне для отслеживания реактивности
  effect(() => {
    templateRenderCount++
    renderedMsg = atom.state.msg
  })
  
  // Проверяем начальный рендер
  expect(templateRenderCount).toBe(1)
  expect(renderedMsg).toBe('Hello World!')
  
  // Изменяем состояние - должно вызвать повторный рендер
  atom.state.msg = 'Updated Message'
  
  expect(templateRenderCount).toBe(2) // Должно быть 2 рендера
  expect(renderedMsg).toBe('Updated Message')
})

test('Template reactivity with multiple state properties', () => {
  const atom = Atom(
    { 
      title: 'My App',
      count: 0,
      isVisible: true
    },
    { plugins: [AtomicStatePlugin] }
  )
  
  // Имитация шаблона, который использует несколько свойств
  let templateRenderCount = 0
  let templateOutput = ''
  
  effect(() => {
    templateRenderCount++
    templateOutput = `${atom.state.title}: ${atom.state.count} - ${atom.state.isVisible ? 'visible' : 'hidden'}`
  })
  
  // Проверяем начальное состояние
  expect(templateRenderCount).toBe(1)
  expect(templateOutput).toBe('My App: 0 - visible')
  
  // Изменяем каждое свойство по очереди и проверяем реактивность
  atom.state.count = 5
  expect(templateRenderCount).toBe(2)
  expect(templateOutput).toBe('My App: 5 - visible')
  
  atom.state.title = 'Updated App'
  expect(templateRenderCount).toBe(3)
  expect(templateOutput).toBe('Updated App: 5 - visible')
  
  atom.state.isVisible = false
  expect(templateRenderCount).toBe(4)
  expect(templateOutput).toBe('Updated App: 5 - hidden')
})

test('Computed values in template with atom state', () => {
  const atom = Atom(
    { 
      firstName: 'Vue',
      lastName: 'Developer',
      count: 10
    },
    { plugins: [AtomicStatePlugin] }
  )
  
  // Имитация вычисляемого свойства в шаблоне
  const fullName = computed(() => `${atom.state.firstName} ${atom.state.lastName}`)
  const doubledCount = computed(() => atom.state.count * 2)
  
  // Имитация рендеринга шаблона
  let templateRenderCount = 0
  let templateContent = ''
  
  effect(() => {
    templateRenderCount++
    templateContent = `${fullName.value} has ${doubledCount.value} points`
  })
  
  // Проверяем начальный рендер
  expect(templateRenderCount).toBe(1)
  expect(templateContent).toBe('Vue Developer has 20 points')
  
  // Изменяем firstName - должно обновить fullName
  atom.state.firstName = 'React'
  expect(templateRenderCount).toBe(2)
  expect(templateContent).toBe('React Developer has 20 points')
  
  // Изменяем count - должно обновить doubledCount
  atom.state.count = 15
  expect(templateRenderCount).toBe(3)
  expect(templateContent).toBe('React Developer has 30 points')
})

test('Template reactivity with nested objects', () => {
  const atom = Atom(
    { 
      user: { 
        profile: { 
          name: 'Vue User',
          settings: { theme: 'light' }
        }
      }
    },
    { plugins: [AtomicStatePlugin] }
  )
  
  // Имитация шаблона, который использует вложенные свойства
  let templateRenderCount = 0
  let templateOutput = ''
  
  effect(() => {
    templateRenderCount++
    templateOutput = `${atom.state.user.profile.name} - ${atom.state.user.profile.settings.theme} theme`
  })
  
  expect(templateRenderCount).toBe(1)
  expect(templateOutput).toBe('Vue User - light theme')
  
  // Изменяем вложенное свойство
  atom.state.user.profile.name = 'Updated Vue User'
  expect(templateRenderCount).toBe(2)
  expect(templateOutput).toBe('Updated Vue User - light theme')
  
  // Изменяем глубоко вложенное свойство
  atom.state.user.profile.settings.theme = 'dark'
  expect(templateRenderCount).toBe(3)
  expect(templateOutput).toBe('Updated Vue User - dark theme')
})

test('Template reactivity with conditional rendering', () => {
  const atom = Atom(
    { 
      count: 0,
      showDetails: false
    },
    { plugins: [AtomicStatePlugin] }
  )
  
  // Имитация условного рендеринга в шаблоне
  let templateRenderCount = 0
  let templateOutput = ''
  
  effect(() => {
    templateRenderCount++
    templateOutput = atom.state.showDetails 
      ? `Count: ${atom.state.count}, Details shown` 
      : `Count: ${atom.state.count}`
  })
  
  expect(templateRenderCount).toBe(1)
  expect(templateOutput).toBe('Count: 0')
  
  // Изменяем значение, которое используется в шаблоне
  atom.state.count = 5
  expect(templateRenderCount).toBe(2)
  expect(templateOutput).toBe('Count: 5')
  
  // Включаем условие, которое меняет шаблон
  atom.state.showDetails = true
  expect(templateRenderCount).toBe(3)
  expect(templateOutput).toBe('Count: 5, Details shown')
  
  // Изменяем снова
  atom.state.count = 10
  expect(templateRenderCount).toBe(4)
  expect(templateOutput).toBe('Count: 10, Details shown')
})

test('Reactive updates through v-model equivalent', () => {
  // Это имитирует v-model в шаблоне Vue
  // v-model создает двустороннюю привязку данных
  const atom = Atom(
    { msg: 'Hello World!' },
    { plugins: [AtomicStatePlugin] }
  )
  
  // Имитация v-model: значение отображается в input и обновляется при вводе
  let templateRenderCount = 0
  let inputValue = atom.state.msg
  
  effect(() => {
    templateRenderCount++
    inputValue = atom.state.msg
  })
  
  expect(templateRenderCount).toBe(1)
  expect(inputValue).toBe('Hello World!')
  
  // Имитация ввода пользователя в поле (v-model обновляет state)
  atom.state.msg = 'Typing in input field'
  expect(templateRenderCount).toBe(2)
  expect(inputValue).toBe('Typing in input field')
  
  // Проверяем, что изменения также отражаются в atom.core
  expect(atom.core.msg.value).toBe('Typing in input field')
})