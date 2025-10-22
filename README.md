# Alak

> Модульная реактивная библиотека управления состоянием для JavaScript/TypeScript

Alak — это ecosystem для построения реактивных приложений с акцентом на модульность, типобезопасность и гибкость. Построена на трех основных слоях: **Nucleus** → **Atom** → **Union**.

## Быстрый старт

```bash
npm install alak
```

```typescript
import { UnionConstructor, UnionModel } from 'alak'

class CounterModel extends UnionModel<'app'> {
  count = 0

  increment() {
    this.count++
  }
}

const { facade } = UnionConstructor({
  namespace: 'app',
  models: { counter: CounterModel }
})

// Подписка на изменения
facade.cores.counter.count.up((value) => {
  console.log('Count:', value)
})

// Обновление состояния
facade.actions.counter.increment()
```

## Архитектура

Alak состоит из нескольких уровней абстракции:

```
┌─────────────────────────────────────┐
│          Union (alak)               │  ← DI контейнер + facade
│  Namespace, Events, Auto-listeners  │
├─────────────────────────────────────┤
│        Atom (@alaq/atom)            │  ← State management
│   Model → Reactive properties       │
├─────────────────────────────────────┤
│      Nucleus (@alaq/nucleus)        │  ← Core reactive primitive
│    Observable-like container        │
└─────────────────────────────────────┘
```

## Основные пакеты

### Ядро

| Пакет | Версия | Описание |
|-------|--------|----------|
| [`@alaq/nucleus`](./packages/nucleus) | 5.0.30 | Реактивный контейнер (Observable-like) |
| [`@alaq/atom`](./packages/atom) | 5.0.37 | State management через модели |
| [`alak`](./packages/alak) | 5.0.66 | Union система с DI и events |

### Интеграции

| Пакет | Версия | Описание |
|-------|--------|----------|
| [`@alaq/vue`](./packages/vue) | 5.0.55 | Vue 3 реактивная интеграция |
| [`@alaq/vite`](./packages/vite) | - | Vite плагин для кодогенерации |

### Утилиты

| Пакет | Описание |
|-------|----------|
| [`@alaq/rune`](./packages/rune) | Генерация случайных строк |
| [`@alaq/ws`](./packages/ws) | WebSocket клиент с автореконнектом |
| [`@alaq/bitmask`](./packages/bitmask) | Работа с битовыми масками |
| [`@alaq/datastruct`](./packages/datastruct) | Структуры данных |
| [`@alaq/svg`](./packages/svg) | SVG утилиты |

## Примеры использования

### Nucleus: Базовая реактивность

```typescript
import { N } from '@alaq/nucleus'

const count = N(0)

count.up((value) => {
  console.log('Count:', value)
})

count(5) // → Count: 5
```

### Atom: Модели с состоянием

```typescript
import { Atom } from '@alaq/atom'

class TodoModel {
  text = ''
  completed = false

  toggle() {
    this.completed = !this.completed
  }
}

const todo = Atom({ model: TodoModel })

todo.core.text('Buy milk')
todo.actions.toggle()

console.log(todo.state.completed) // true
```

### Union: DI и организация

```typescript
import { UnionConstructor, UnionModel } from 'alak'

class TodosModel extends UnionModel<'app'> {
  items = []

  // Автоматически подписывается на изменения this.items
  _items_up(value) {
    console.log('Items changed:', value.length)
  }
}

class FilterModel extends UnionModel<'app'> {
  current = 'all'

  // Подписка на другой atom
  _$todos_items_up(items) {
    console.log('Todos updated from filter')
  }
}

const { facade } = UnionConstructor({
  namespace: 'app',
  models: {
    todos: TodosModel,
    filter: FilterModel
  }
})
```

### Vue интеграция

```vue
<script setup>
import { watchVueAtom } from '@alaq/vue'
import { injectFacade } from 'alak'

const u = injectFacade('app')
const todos = watchVueAtom(u.atoms.todos)
</script>

<template>
  <div v-for="item in todos.items">
    {{ item.text }}
  </div>
</template>
```

## Ключевые возможности

✅ **Модульность** — используйте только нужные слои
✅ **TypeScript** — полная типизация из коробки
✅ **Автоматические подписки** — через naming convention
✅ **DI система** — через union namespaces
✅ **Vue интеграция** — двусторонняя синхронизация
✅ **Persistence** — автосохранение в localStorage
✅ **Computed values** — реактивные геттеры
✅ **Event bus** — глобальные и локальные события

## Документация

- [Архитектура](./docs/ARCHITECTURE.md)
- [Инструкции для разработки](./CLAUDE.md)

Документация по каждому пакету доступна в соответствующей папке `packages/*/README.md`

## Разработка

```bash
# Установить зависимости
npm install

# Запустить интерактивную build-систему
npm start

# Тесты
npm test

# Форматирование
npm run format
```

## Структура монорепо

```
alak/
├── packages/
│   ├── nucleus/      # @alaq/nucleus - реактивный примитив
│   ├── atom/         # @alaq/atom - state management
│   ├── alak/         # alak - union система
│   ├── vue/          # @alaq/vue - Vue 3 интеграция
│   ├── vite/         # @alaq/vite - Vite плагин
│   ├── rune/         # @alaq/rune - утилиты
│   ├── ws/           # @alaq/ws - WebSocket
│   ├── bitmask/      # @alaq/bitmask - битовые маски
│   ├── datastruct/   # @alaq/datastruct - структуры данных
│   └── svg/          # @alaq/svg - SVG утилиты
└── scripts/          # Кастомная build-система
```

## Лицензия

TVR

## Автор

Gleb Panteleev

## Ссылки

- [GitHub](https://github.com/carabins/alak)
- [Issues](https://github.com/carabins/alak/issues)
