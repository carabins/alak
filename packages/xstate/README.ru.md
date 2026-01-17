# @alaq/xstate

**StateX: Адаптер интеграции XState для экосистемы Alak.**

[![Читать на английском](https://img.shields.io/badge/Language-English-blue)](./README.md)

StateX связывает XState state machines с реактивной системой Alak. XState выступает как "мозг" (логика переходов состояний), а Alak как "тело" (реактивные данные, UI binding, эффекты).

### 📦 Установка

```bash
bun add @alaq/xstate xstate
# или
npm install @alaq/xstate xstate
```

---

### 🛠 Пример архитектуры

В этом сценарии мы интегрируем XState машину, спроектированную в [Stately.ai](https://stately.ai/viz), с реактивными примитивами Alak для бесшовного UI binding и управления эффектами.

```typescript
import { setup, assign } from 'xstate'
import { fromMachine } from '@alaq/xstate'
import { Qv } from '@alaq/quark'

// --- Машина: Спроектирована в Stately.ai ---
const heaterMachine = setup({
  types: {
    context: {} as { target: number; current: number },
    events: {} as 
      | { type: 'SENSOR_UPDATE'; temp: number }
      | { type: 'TOGGLE' }
  }
}).createMachine({
  id: 'heater',
  initial: 'inactive',
  context: { target: 22, current: 20 },
  states: {
    inactive: { on: { TOGGLE: 'active' } },
    active: {
      initial: 'heating',
      on: { TOGGLE: 'inactive' },
      states: {
        heating: { /* ... */ },
        idle: { /* ... */ }
      }
    }
  }
})

// --- Адаптер: Интеграция с Alak ---
const heater = fromMachine(heaterMachine)

// --- Реактивные привязки ---
heater.state().up(s => console.log('Состояние:', s))
heater.ctx('target').up(t => console.log('Цель:', t))

const isActive = heater.state('active')
isActive.up(active => button.classList.toggle('active', active))

// --- Привязка ввода ---
const sensor = Qv(20)
heater.toEvent(sensor, 'SENSOR_UPDATE', 'temp')

sensor(25) // Авто-отправка: { type: 'SENSOR_UPDATE', temp: 25 }

// --- Очистка ---
heater.decay()
```

### Базовое использование (минимальный паттерн)

Если нужно просто подключить машину к реактивному состоянию, используйте базовый паттерн.

```typescript
import { setup } from 'xstate'
import { fromMachine } from '@alaq/xstate'

const toggleMachine = setup({}).createMachine({
  id: 'toggle',
  initial: 'inactive',
  states: {
    inactive: { on: { TOGGLE: 'active' } },
    active: { on: { TOGGLE: 'inactive' } }
  }
})

const toggle = fromMachine(toggleMachine)

toggle.state('active').up(active => console.log('Active:', active))
toggle.send({ type: 'TOGGLE' }) // Active: true
```

---

### 📚 Документация

*   **[Концепция](./docs/ru/CONCEPT.md)** — Философия: state machines как мозг, реактивные примитивы как тело.
*   **[Полная спецификация](./SPEC.md)** — Полный справочник API со всеми методами и опциями.

---

### ⚡ Ключевые возможности

StateX создан для объединения явного моделирования состояний XState с реактивной эффективностью Alak.

| Возможность | Описание |
| :--- | :--- |
| **Визуальный дизайн** | Проектируйте машины в [Stately.ai](https://stately.ai/viz), используйте в коде |
| **Привязка состояния** | `.state()` для полного состояния, `.state('value')` для matcher |
| **Селекторы контекста** | `.ctx()` со строковыми путями или функциями |
| **Проверка can** | `.can(event)` возвращает реактивный boolean |
| **Поток actions** | `.action(type?)` для прослушивания выполненных actions |
| **Привязка ввода** | `.toEvent()` и `.asEvent()` для реактивных inputs |
| **Выбор примитива** | Quark (по умолчанию) или Nucl с плагинами |
| **Автоочистка** | `.decay()` останавливает машину и очищает все подписки |
| **TypeScript** | Полный вывод типов из определений XState машин |
