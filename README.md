# Alak

> Реактивная система управления состоянием для JavaScript/TypeScript

Alak — это библиотека управления состоянием с реактивностью, типизацией и dependency injection.

## Установка

```bash
npm install alak
```

## Быстрый старт

```typescript
import { UnionModel, GetUnionCore, Q } from 'alak'

// 1. Создайте модель
class CounterModel extends UnionModel {
  count = 0
  countX10 = 0

  increment() {
    this.count++
  }

  _count_up(v){
    this.countX10 = v*10
  }

  _on_INIT(){
    this.count = 1
  }
  _on_SET_COUNT(v){
    this.count = v
  }
}

// 2. Зарегистрируйте в union
const union = GetUnionCore('default')
union.addAtom({ model: CounterModel, name: 'counter' })

// 3. Используйте через Q
const core = Q('counterCore')
const actions = Q('counterActions')

core.countX10.up(value => console.log('Count:', value))
actions.increment()
union.bus.dispatchEvent("SET_COUNT", 0)
core.count(10)

// Count: 10
// Count: 20
// Count: 0
// Count: 100
```

## Q API — основной способ использования

```typescript
import { Q } from 'alak'

// Суффиксы для выбора части atom'а
Q('counter')         // → { atom, core, state, actions }
Q('counterAtom')     // → полный atom
Q('counterCore')     // → nucleus'ы для подписок
Q('counterState')    // → текущие значения
Q('counterActions')  // → методы модели
```

## Архитектура

```
┌─────────────────────────────────────┐
│          Union (alak)               │  ← DI + namespace
├─────────────────────────────────────┤
│        Atom (@alaq/atom)            │  ← State management
├─────────────────────────────────────┤
│      Nucleus (@alaq/nucleus)        │  ← Реактивный примитив
└─────────────────────────────────────┘
```

### Nucleus — реактивный контейнер

```typescript
import { N } from '@alaq/nucleus'

const count = N(0)

count.up(value => console.log('Count:', value))
count(5) // → Count: 5
```

### Atom — модель с состоянием

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

### Union — namespace и DI

```typescript
import { UnionModel, GetUnionCore } from 'alak'

class TodosModel extends UnionModel {
  items = []

  // Автоподписка на this.items
  _items_up(value) {
    console.log('Items:', value.length)
  }
}

const union = GetUnionCore('default')
union.addAtom({ model: TodosModel, name: 'todos' })
```

## TypeScript типизация

```typescript
declare module 'alak/namespaces' {
  interface QNamespace {
    current: 'myApp'
  }

  interface ActiveUnions {
    myApp: IUnionCore<{
      Counter: typeof CounterModel
    }, {}, {}, {}>
  }
}

// Теперь Q полностью типизирован
const core = Q('counterCore') // ✅ Автодополнение работает
```

## Основные пакеты

| Пакет | Описание |
|-------|----------|
| `alak` | Union система с DI |
| `@alaq/atom` | State management |
| `@alaq/nucleus` | Реактивный примитив |
| `@alaq/vue` | Vue 3 интеграция |

## Документация

Подробная документация в `packages/alak/README.md`

## Разработка

```bash
npm install
npm start  # интерактивная build-система
npm test
```

## Лицензия

TVR
