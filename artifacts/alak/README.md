# alak

> Система управления состоянием с dependency injection через unions и namespaces

Alak — это полнофункциональная библиотека управления состоянием, объединяющая несколько atom'ов в namespace с автоматической регистрацией зависимостей и умным фасадом доступа.

## Установка

```bash
npm install alak
```

## Основные концепции

- **Union** — namespace для группировки atom'ов
- **Facade** — умный Proxy для удобного доступа к atom'ам
- **Listeners** — автоматическая подписка через naming convention
- **Events** — глобальная шина событий для union

## Примеры использования

### Пример 1: Простой Union с моделями

```typescript
import { UnionConstructor, UnionModel } from 'alak'

class CounterModel extends UnionModel<'myApp'> {
  count = 0

  increment() {
    this.count++
  }

  get doubled() {
    return this.count * 2
  }
}

class UserModel extends UnionModel<'myApp'> {
  name = 'Guest'
  isLoggedIn = false

  login(name: string) {
    this.name = name
    this.isLoggedIn = true
  }
}

const { facade } = UnionConstructor({
  namespace: 'myApp',
  models: {
    counter: CounterModel,
    user: UserModel
  }
})

// Доступ через facade (4 способа!)
facade.counterState.count        // → 0
facade.states.counter.count      // → 0
facade.counterCore.count.value   // → 0
facade.cores.counter.count.value // → 0

// Вызов actions
facade.counterCore.increment()   // → count = 1
facade.actions.counter.increment() // → count = 2

// Подписка на изменения
facade.cores.counter.count.up((v) => {
  console.log('Count changed:', v)
})
```

### Пример 2: Автоматические listeners (через naming convention)

```typescript
import { UnionConstructor, UnionModel } from 'alak'

class StatsModel extends UnionModel<'myApp'> {
  clicks = 0
  lastClickTime = null

  // Автоматически подписывается на this.clicks
  _clicks_up(value) {
    console.log('Clicks updated:', value)
    this.lastClickTime = Date.now()
  }
}

class CounterModel extends UnionModel<'myApp'> {
  count = 0

  increment() { this.count++ }

  // Автоматически подписывается на stats.clicks из другого atom
  _$stats_clicks_up(value) {
    console.log('Stats clicks from counter:', value)
  }
}

const { facade } = UnionConstructor({
  namespace: 'myApp',
  models: {
    stats: StatsModel,
    counter: CounterModel
  }
})

facade.cores.stats.clicks(5)
// → Clicks updated: 5
// → Stats clicks from counter: 5
```

### Пример 3: События и фабрики atom'ов

```typescript
import { UnionConstructor, UnionMultiModel } from 'alak'

// Модель для создания множества экземпляров
class TodoModel extends UnionMultiModel<'todoApp'> {
  text = ''
  completed = false

  toggle() {
    this.completed = !this.completed
  }

  // Обработчик события
  _on_CLEAR_COMPLETED() {
    if (this.completed) {
      this.text = ''
    }
  }
}

class AppModel extends UnionModel<'todoApp'> {
  filter = 'all'

  clearCompleted() {
    // Отправить событие всем todo
    this._.bus.dispatchEvent('CLEAR_COMPLETED')
  }
}

const { facade } = UnionConstructor({
  namespace: 'todoApp',
  models: {
    app: AppModel
  },
  factories: {
    todo: TodoModel  // Фабрика для создания экземпляров
  }
})

// Создать todo экземпляры
const todo1 = facade.atoms.todo.get(1)
const todo2 = facade.atoms.todo.get(2)

todo1.core.text('Buy milk')
todo2.core.text('Learn Alak')
todo1.actions.toggle() // completed = true

// Очистить все завершенные
facade.actions.app.clearCompleted()
```

## Naming Convention для Listeners

Alak автоматически подписывается на nucleus через имена методов:

| Паттерн | Описание | Пример |
|---------|----------|--------|
| `_propertyName_up(v)` | Подписка на свой nucleus | `_count_up(v)` |
| `_propertyName_next(v)` | Только следующее изменение | `_count_next(v)` |
| `_$atomName_property_up(v)` | Подписка на другой atom | `_$user_name_up(v)` |
| `_on_EVENT_NAME(data)` | Обработчик события | `_on_USER_LOGIN(data)` |

## Facade API

Умный Proxy предоставляет несколько способов доступа:

```typescript
const { facade } = UnionConstructor({ ... })

// Суффиксы для доступа
facade.modelNameCore     // → atom.core
facade.modelNameState    // → atom.state
facade.modelNameAtom     // → atom
facade.modelNameBus      // → atom.bus

// Сгруппированный доступ
facade.cores.modelName   // → atom.core
facade.states.modelName  // → atom.state
facade.atoms.modelName   // → atom
facade.buses.modelName   // → atom.bus
facade.actions.modelName // → atom.actions

// Глобальная шина событий
facade.bus.dispatchEvent('MY_EVENT', data)
facade.bus.addEventListener('MY_EVENT', handler)
```

## Dependency Injection

```typescript
import { injectFacade } from 'alak'

// В другом модуле
const u = injectFacade('myApp')
u.states.counter.count // Доступ к уже созданному union
```

## TypeScript Support

```typescript
import { UnionConstructor } from 'alak'

const uc = UnionConstructor({
  namespace: 'myApp',
  models: { counter: CounterModel }
})

// Регистрация для автодополнения
declare module 'alak/namespaces' {
  interface ActiveUnions {
    myApp: typeof uc
  }
}

// Теперь injectFacade знает типы!
const u = injectFacade('myApp')
```

## Зависимости

Включает `@alaq/nucleus`, `@alaq/atom`, `@alaq/rune`

## Лицензия

TVR
