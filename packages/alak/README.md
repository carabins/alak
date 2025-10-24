# alak

> Реактивная система управления состоянием с dependency injection через unions и namespaces

Alak — это библиотека управления состоянием, объединяющая atom'ы в namespace с автоматической регистрацией зависимостей и элегантным Q API для доступа.

## Установка

```bash
npm install alak
```

## Быстрый старт

### 1. Создайте модели

```typescript
import { UnionModel } from 'alak'

class CounterModel extends UnionModel {
  count = 0

  increment() {
    this.count++
  }

  get doubled() {
    return this.count * 2
  }
}

class UserModel extends UnionModel {
  name = 'Guest'
  isLoggedIn = false

  login(name: string) {
    this.name = name
    this.isLoggedIn = true
  }
}
```

### 2. Зарегистрируйте atom'ы в union

```typescript
import { GetUnionCore } from 'alak'

const union = GetUnionCore('default')

union.addAtom({ model: CounterModel, name: 'counter' })
union.addAtom({ model: UserModel, name: 'user' })
```

### 3. Используйте Q для доступа (основной способ)

```typescript
import { Q } from 'alak'

// Получить atom
const atom = Q('counterAtom')

// Получить core (nucleus'ы для подписок)
const core = Q('counterCore')
core.count.up(v => console.log('Count:', v))

// Получить state (текущие значения)
const state = Q('counterState')
console.log(state().count) // 0

// Получить actions (методы)
const actions = Q('counterActions')
actions.increment()

// Или получить всё сразу
const { atom, core, state, actions } = Q('counter')
```

## Q API — основной способ использования

Q — это типизированный инжектор для доступа к atom'ам из любого места приложения.

### Суффиксы для выбора части atom'а

```typescript
import { Q } from 'alak'

Q('counter')         // → { atom, core, state, actions }
Q('counterAtom')     // → IAtom<CounterModel>
Q('counterCore')     // → IAtomCore (nucleus'ы для подписок)
Q('counterState')    // → () => State (текущие значения)
Q('counterActions')  // → Actions (методы модели)
```

### Работа с Core (подписки и реактивность)

```typescript
const core = Q('counterCore')

// Подписка на изменения
core.count.up(value => {
  console.log('Count changed:', value)
})

// Изменение значения (вызовет подписчиков)
core.count(10)

// Текущее значение
console.log(core.count.value) // 10
```

### Работа с State (геттер текущих значений)

```typescript
const state = Q('counterState')

// State — это функция, возвращающая прокси
console.log(state().count)    // 10
console.log(state().doubled)  // 20

// Каждый вызов возвращает свежие значения
core.count(5)
console.log(state().count)    // 5
```

### Работа с Actions (методы модели)

```typescript
const actions = Q('counterActions')

// Вызов методов
actions.increment()
actions.increment()

console.log(state().count) // 7
```

## TypeScript типизация

### Объявление namespace и моделей

```typescript
import { IUnionCore } from 'alak'

declare module 'alak/namespaces' {
  interface QNamespace {
    current: 'myApp'  // Текущий namespace для Q
  }

  interface ActiveUnions {
    myApp: IUnionCore<{
      Counter: typeof CounterModel
      User: typeof UserModel
    }, {}, {}, {}>
  }
}
```

Теперь Q полностью типизирован:

```typescript
import { Q } from 'alak'

// TypeScript знает все доступные atom'ы
const atom = Q('counterAtom')  // ✅ IAtom<CounterModel>
const atom = Q('productAtom')  // ❌ Error: 'productAtom' не существует

// Автодополнение работает
const core = Q('counterCore')
core.count.up(v => {
  // v автоматически типизирован как number
})
```

### Опциональный namespace в моделях

```typescript
// Без параметра — использует QNamespace.current (default: 'default')
class CounterModel extends UnionModel {
  count = 0
}

// С явным namespace
class AdminModel extends UnionModel<'admin'> {
  role = 'admin'
}
```

## Мультиконтекстные приложения

### QRealm для работы с несколькими namespace

```typescript
import { Q, QRealm } from 'alak'

// Q работает с текущим namespace (из QNamespace.current)
const counter = Q('counterAtom')

// QRealm создаёт Q для другого namespace
const AdminQ = QRealm('admin')
const dashboard = AdminQ('dashboardAtom')
const adminCore = AdminQ('dashboardCore')

// Или через Q.realm()
const PublicQ = Q.realm('public')
const landing = PublicQ('landingState')
```

### Типизация для мультиконтекста

```typescript
declare module 'alak/namespaces' {
  interface QNamespace {
    current: 'myApp'  // Основной namespace
  }

  interface ActiveUnions {
    myApp: IUnionCore<{
      Counter: typeof CounterModel
      User: typeof UserModel
    }, {}, {}, {}>

    admin: IUnionCore<{
      Dashboard: typeof DashboardModel
    }, {}, {}, {}>

    public: IUnionCore<{
      Landing: typeof LandingModel
    }, {}, {}, {}>
  }
}

// Теперь все QRealm типизированы
const AdminQ = QRealm('admin')
AdminQ('dashboardAtom')  // ✅ Типы работают
AdminQ('counterAtom')    // ❌ Error: counter не в admin namespace
```

## Автоматические Listeners

Alak автоматически подписывается на изменения через naming convention:

```typescript
class StatsModel extends UnionModel {
  clicks = 0
  lastClickTime = null

  // Автоматически подписывается на this.clicks
  _clicks_up(value) {
    console.log('Clicks updated:', value)
    this.lastClickTime = Date.now()
  }
}

class CounterModel extends UnionModel {
  count = 0

  // Подписка на clicks из stats atom
  _$stats_clicks_up(value) {
    console.log('Stats clicks from counter:', value)
  }

  // Обработчик события
  _on_USER_LOGIN(data) {
    console.log('User logged in:', data)
  }
}
```

### Naming Convention

| Паттерн | Описание | Пример |
|---------|----------|--------|
| `_propertyName_up(v)` | Подписка на свой nucleus | `_count_up(v)` |
| `_propertyName_next(v)` | Только следующее изменение | `_count_next(v)` |
| `_$atomName_property_up(v)` | Подписка на другой atom | `_$user_name_up(v)` |
| `_on_EVENT_NAME(data)` | Обработчик события | `_on_USER_LOGIN(data)` |

## Отличия Atom, Core, State, Actions

### Atom — полный объект

```typescript
const atom = Q('counterAtom')

atom.core        // Nucleus'ы для подписок
atom.state       // Прокси с текущими значениями
atom.actions     // Методы модели
atom.bus         // Шина событий
atom.known       // Метаданные
```

### Core — nucleus'ы для реактивности

```typescript
const core = Q('counterCore')

core.count          // Nucleus<number>
core.count.value    // Текущее значение (геттер)
core.count(10)      // Установить значение (вызовет подписчиков)
core.count.up(fn)   // Подписаться на изменения
```

### State — геттер значений

```typescript
const state = Q('counterState')

state()         // { count: 0, name: 'counter', doubled: 0 }
state().count   // 0
state().doubled // 0 (computed)

// Каждый вызов возвращает актуальный state
```

### Actions — методы модели

```typescript
const actions = Q('counterActions')

actions.increment()   // Вызов метода
actions.decrement()   // Вызов метода
```

## Продвинутые возможности

### Facade API (альтернативный способ)

Если вам нужен прямой доступ к union, используйте facade:

```typescript
import { GetUnionCore } from 'alak'

const union = GetUnionCore('myApp')

// Facade предоставляет несколько способов доступа
union.facade.counterCore          // → atom.core
union.facade.counterState         // → atom.state
union.facade.counterAtom          // → atom
union.facade.cores.counter        // → atom.core
union.facade.states.counter       // → atom.state
union.facade.actions.counter      // → atom.actions

// Глобальная шина событий
union.facade.bus.dispatchEvent('MY_EVENT', data)
union.facade.bus.addEventListener('MY_EVENT', handler)
```

### UnionConstructor (для миграции)

Старый способ создания union с предрегистрацией моделей:

```typescript
import { UnionConstructor } from 'alak'

const { facade } = UnionConstructor({
  namespace: 'myApp',
  models: {
    counter: CounterModel,
    user: UserModel
  }
})

// Использование через facade
facade.counterState.count
facade.actions.counter.increment()
```

Рекомендуется использовать **Q API** для более гибкой и элегантной работы.

## Зависимости

Включает `@alaq/nucleus`, `@alaq/atom`, `@alaq/rune`

## Лицензия

TVR
