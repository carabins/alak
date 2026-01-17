# @alaq/xstate

> StateX: XState integration adapter for Alak ecosystem

## Концепция

Интеграция XState state machines с реактивной системой Alak. XState выступает как "мозг" (логика переходов состояний), Alak как "тело" (реактивные данные, UI binding, эффекты).

### Зачем интеграция?

| | XState | Alak (Quark/Nucl/fx) |
|---|--------|---------------------|
| **Фокус** | Явные состояния и переходы | Реактивные данные и эффекты |
| **Сила** | "Что может произойти" | "Как данные меняются" |
| **Визуализация** | [Stately.ai](https://stately.ai/viz) | - |
| **Типобезопасность** | Сильная (typegen) | Сильная |

**Результат:** Проектируешь логику в визуальном редакторе Stately.ai, связываешь с реактивным UI через Alak.

---

## Проблема которую решает

### Без интеграции - ручная синхронизация

```typescript
import { createActor } from 'xstate'
import { Nv } from '@alaq/nucl'

const actor = createActor(machine).start()

// Ручная синхронизация - boilerplate
const currentState = Nv(actor.getSnapshot().value)
const context = Nv(actor.getSnapshot().context)

actor.subscribe((snapshot) => {
  currentState(snapshot.value)
  context(snapshot.context)
})

// Нужно не забыть очистить
actor.stop()
```

### С @alaq/xstate - автоматическая интеграция

```typescript
import { fromMachine } from '@alaq/xstate'

const player = fromMachine(playerMachine)

// Всё реактивно из коробки
player.state().up(s => console.log(s))
player.ctx().up(ctx => console.log(ctx))

// Cleanup автоматический
player.decay()
```

---

## Core API

### `fromMachine(machine, options?)`

Создаёт Alak-совместимый адаптер из XState machine.

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
```

**Options:**

```typescript
interface AdapterOptions {
  /**
   * Reactive primitive to use.
   * 'quark' - Lightweight, faster (default).
   * 'nucl' - Supports plugins (persistence, deep-observing).
   */
  primitive?: 'quark' | 'nucl'
  
  /** Options passed to Nv() if primitive is 'nucl' */
  nuclOptions?: INuOptions

  /** Auto-start the actor (default: true) */
  autoStart?: boolean
  
  /** Initial input/context override */
  input?: any
}
```

---

## Adapter API

### `.actor` - raw XState Actor

```typescript
const player = fromMachine(playerMachine)

// Direct access to XState actor
player.actor.getSnapshot()
```

### `.state(matches?)` - текущее состояние

```typescript
const heater = fromMachine(heaterMachine)

// Полное состояние (Quark<StateValue>)
heater.state().up((stateValue) => {
  console.log('Current:', stateValue)  // 'idle' | { active: 'heating' }
})

// Проверка состояния (Quark<boolean>)
const isActive = heater.state('active')
isActive.up(active => {
  element.classList.toggle('active', active)
})

// Вложенные состояния
const isHeating = heater.state('active.heating')
```

### `.ctx(selector?)` - контекст машины

```typescript
// Весь контекст
heater.ctx().up((ctx) => {
  console.log('Target:', ctx.target)
  console.log('Current:', ctx.current)
})

// String selector (path)
const targetQ = heater.ctx('target')
targetQ.up(target => console.log('Target temp:', target))

// Function selector
const gapQ = heater.ctx(c => c.target - c.current)
gapQ.up(gap => console.log('Temperature gap:', gap))
```

### `.can(eventType)` - проверка возможности перехода

```typescript
const canToggle = heater.can('TOGGLE')

canToggle.up(can => {
  toggleButton.disabled = !can
})

const canUpdate = heater.can('SENSOR_UPDATE')
// false в inactive, true в active
```

### `.action(type?)` - поток экшенов

```typescript
// Все экшены
heater.action().up(action => {
  console.log('Action executed:', action)
})

// Фильтрация по типу
heater.action('notifyUser').up(() => {
  showNotification('Heater is now heating!')
})
```

### `.send(event)` - отправка событий

```typescript
// Простое событие
heater.send({ type: 'TOGGLE' })

// Событие с данными
heater.send({ type: 'SENSOR_UPDATE', temp: 25 })
heater.send({ type: 'SET_TARGET', value: 24 })
```

### `.toEvent(quark, eventType, key?)` - привязка quark к событию

Автоматически отправляет событие при изменении quark.

```typescript
const sensor = Qv(20)

// Когда sensor меняется -> отправляется { type: 'SENSOR_UPDATE', temp: value }
heater.toEvent(sensor, 'SENSOR_UPDATE', 'temp')

sensor(25) // Автоматически: heater.send({ type: 'SENSOR_UPDATE', temp: 25 })
```

### `.asEvent(quark, eventType?)` - привязка quark как события

```typescript
const control = Qv<any>(undefined)

// Quark значение отправляется как событие напрямую
heater.asEvent(control)

control({ type: 'TOGGLE' }) // Автоматически: heater.send({ type: 'TOGGLE' })

// С добавлением type
const data = Qv<any>(undefined)
heater.asEvent(data, 'UPDATE')

data({ field: 'value' }) // Автоматически: heater.send({ type: 'UPDATE', field: 'value' })
```

### `.start()` / `.stop()` - управление актором

```typescript
const player = fromMachine(playerMachine, { autoStart: false })

player.start() // Запуск
player.stop()  // Остановка
```

### `.decay()` - полная очистка

Останавливает машину и очищает все подписки.

```typescript
player.decay()
```

---

## Примеры использования

### Пример: Heater (из тестов)

```typescript
import { setup, assign } from 'xstate'
import { fromMachine } from '@alaq/xstate'
import { Qv } from '@alaq/quark'

const heaterMachine = setup({
  types: {
    context: {} as { target: number; current: number },
    events: {} as 
      | { type: 'SENSOR_UPDATE'; temp: number }
      | { type: 'SET_TARGET'; value: number }
      | { type: 'TOGGLE' }
  },
  actions: {
    notifyUser: () => console.log('Heater is heating!')
  }
}).createMachine({
  id: 'heater',
  initial: 'inactive',
  context: { target: 22, current: 20 },
  states: {
    inactive: {
      on: { TOGGLE: 'active' }
    },
    active: {
      initial: 'checking',
      on: { TOGGLE: 'inactive' },
      states: {
        checking: {
          always: [
            { target: 'heating', guard: ({ context }) => context.current < context.target },
            { target: 'idle' }
          ]
        },
        idle: {
          on: { 
            SENSOR_UPDATE: {
               target: 'checking',
               actions: assign({ current: ({ event }) => event.temp })
            }
          }
        },
        heating: {
          entry: { type: 'notifyUser' },
          on: {
            SENSOR_UPDATE: {
              target: 'checking',
              actions: assign({ current: ({ event }) => event.temp })
            }
          }
        }
      }
    }
  },
  on: {
    SET_TARGET: {
      actions: assign({ target: ({ event }) => event.value })
    }
  }
})

// --- Usage ---
const heater = fromMachine(heaterMachine)

// State binding
const isActive = heater.state('active')
isActive.up(active => console.log('Active:', active))

// Context selectors
const targetQ = heater.ctx('target')
const gapQ = heater.ctx(c => c.target - c.current)

// Sensor binding
const sensor = Qv(20)
heater.toEvent(sensor, 'SENSOR_UPDATE', 'temp')

// Action listener
heater.action('notifyUser').up(() => {
  console.log('Notification: heating started')
})

// Control
heater.send({ type: 'TOGGLE' }) // -> active.heating
sensor(25) // -> active.idle (temp reached)

// Cleanup
heater.decay()
```

---

## Внутренняя архитектура

### Структура файлов (актуальная)

```
packages/xstate/
├── src/
│   ├── index.ts           # Публичный API (export)
│   ├── fromMachine.ts     # Основной адаптер
│   └── utils.ts           # Вспомогательные функции (getPath)
├── test/
│   └── integration.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

### Зависимости

```json
{
  "peerDependencies": {
    "xstate": "^5.0.0",
    "@alaq/quark": "*"
  },
  "optionalPeerDependencies": {
    "@alaq/nucl": "*"
  }
}
```

### Выбор примитива (Quark vs Nucl)

По умолчанию используется **Quark**. Можно переключить на **Nucl** для доступа к плагинам:

```typescript
import { fromMachine } from '@alaq/xstate'

// Default: Quark
const player = fromMachine(playerMachine)

// С Nucl
const player = fromMachine(playerMachine, {
  primitive: 'nucl',
  nuclOptions: { kind: 'std' }
})
```

### Типизация

```typescript
import { AnyStateMachine, EventFrom, ContextFrom } from 'xstate'
import { IQuark } from '@alaq/quark'

interface MachineAdapter<TMachine extends AnyStateMachine> {
  actor: Actor<TMachine>
  state(matches?: string): IQuark<any>
  ctx<T = any>(selector?: string | ((context: ContextFrom<TMachine>) => T)): IQuark<T>
  can(eventType: EventFrom<TMachine>['type']): IQuark<boolean>
  action(type?: string): IQuark<any>
  toEvent<T>(quark: IQuark<T>, eventType: string, key?: string): void
  asEvent<T extends object>(quark: IQuark<T>, eventType?: string): void
  send(event: EventFrom<TMachine>): void
  start(): void
  stop(): void
  decay(): void
}
```

---

## НЕ РЕАЛИЗОВАНО (TODO)

Следующие возможности из оригинальной спецификации **не реализованы**:

1. **Quantum Bus интеграция**
   - `id`, `realm`, `emitTransitions` options
   - Трансляция событий в Quantum Bus

2. **fx интеграция** - работает через стандартный API, но нет специальных хелперов

3. **Chaining `.send()`** - `.send()` не возвращает adapter для цепочки

4. **XState Inspector** - интеграция с devtools

5. **Persistence** - сериализация состояния машины

---

## Open Questions

1. **Actors:** Поддержка XState actors (spawned machines)?
2. **Devtools:** Интеграция с XState Inspector?
3. **Persistence:** Сериализация состояния машины?
