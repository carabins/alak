# ALAQ - API Design

## Общий принцип

**ALAQ** предоставляет три уровня API:

1. **Q (строковые пути)** - рекомендуемый, простой и типобезопасный
2. **Realm facade** - legacy ALAK API для совместимости
3. **Direct atom access** - низкоуровневый доступ

## Базовый пример

```typescript
import { realm, Q, UnionModel } from 'alaq'
import { natural } from 'alaq/styles'

// 1. Создать realm
const app = realm('app', {
  origins: {
    counter: {
      count: 0,
      step: 1,
      increment() { this.count += this.step }
    }
  }
})

// 2. Подключить стиль
Q.use(natural)

// 3. Работать с состоянием
const count = Q.ask('app.counter.count')     // 0
Q.tell('app.counter.count', 10)              // set to 10
Q.hear('app.counter.count', v => {
  console.log('Count changed:', v)
})
Q.call('app.counter.increment')              // count = 11
```

## Q API

### Подключение стилей

```typescript
import { Q } from 'alaq'
import { natural, technical, poetic } from 'alaq/styles'

// Один стиль
Q.use(natural)
Q.ask('counter.count')

// Несколько стилей
Q.use([natural, technical])
Q.ask('counter.count')    // natural
Q.get('counter.count')    // technical

// Смена стиля
Q.style('natural')
Q.ask('counter.count')

Q.style('technical')
Q.get('counter.count')
```

### Работа с путями

```typescript
// Полный путь (realm.origin.property)
Q.ask('app.counter.count')

// С указанием realm
Q.from('app').ask('counter.count')

// Установить контекст
Q.in('app')
Q.ask('counter.count')      // теперь в app
Q.ask('user.name')          // тоже в app
```

### Встроенные стили

#### Natural style (рекомендуемый)
```typescript
import { natural } from 'alaq/styles'
Q.use(natural)

Q.ask('counter.count')              // получить
Q.tell('counter.count', 10)         // установить
Q.hear('counter.count', fn)         // подписаться
Q.call('counter.increment')         // вызвать
```

#### Technical style
```typescript
import { technical } from 'alaq/styles'
Q.use(technical)

Q.get('counter.count')
Q.set('counter.count', 10)
Q.watch('counter.count', fn)
Q.invoke('counter.increment')
```

#### Poetic style
```typescript
import { poetic } from 'alaq/styles'
Q.use(poetic)

Q.seek('counter.count')
Q.grant('counter.count', 10)
Q.witness('counter.count', fn)
Q.summon('counter.increment')
```

#### Minimal style
```typescript
import { minimal } from 'alaq/styles'
Q.use(minimal)

Q.$('counter.count')
Q.$$('counter.count', 10)
Q.on('counter.count', fn)
Q.do('counter.increment')
```

---

## Realm API

### Создание realm

```typescript
import { realm } from 'alaq'

// Простой realm
const app = realm('app')

// С origins
const app = realm('app', {
  origins: {
    counter: { count: 0 },
    user: { name: '' }
  }
})

// Иерархический (Java-style)
const app = realm('com.company.app')
const admin = realm('com.company.admin')

// Вложенный
const com = realm('com')
const company = com.realm('company')
const app = company.realm('app')
```

### Регистрация origins

```typescript
const app = realm('app')

// Объект
app.origin('settings', {
  theme: 'dark',
  language: 'en'
})

// Класс
class Counter extends UnionModel<'app'> {
  static modelName = 'counter'
  count = 0
  increment() { this.count++ }
}

app.origin('counter', Counter)
```

---

## UnionModel API

### Базовый класс

```typescript
import { UnionModel } from 'alaq'

class Counter extends UnionModel<'app'> {
  static modelName = 'counter'

  // State properties
  count: number = 0
  step: number = 1

  // Actions
  increment() {
    this.count += this.step
  }

  decrement() {
    this.count -= this.step
  }

  reset() {
    this.count = 0
  }
}
```

### Listeners

```typescript
class Counter extends UnionModel<'app'> {
  static modelName = 'counter'

  count = 0

  // Локальный listener (на свое свойство)
  _count_up(newValue: number) {
    console.log('Count changed:', newValue)
  }

  // Listener на другую модель (тот же realm)
  _$user_authenticated_up(isAuth: boolean) {
    if (!isAuth) {
      this.count = 0  // сброс при logout
    }
  }

  // Listener на другой realm
  _$admin:settings_theme_up(theme: string) {
    console.log('Theme in admin changed:', theme)
  }
}
```

**Формат:**
```
_property_up                      → this.property
_$model_property_up               → model в том же realm
_$realm:model_property_up         → model в другом realm
```

### Доступ к facade через this._

```typescript
class Counter extends UnionModel<'app'> {
  count = 0

  resetUser() {
    // Обращение к другой модели через facade
    this._.cores.user.authenticated(false)

    // Или через Q
    this._.Q.tell('user.authenticated', false)

    // Или прямо
    Q.tell('app.user.authenticated', false)
  }
}
```

---

## TypeScript типизация

### Автоматическая типизация

```typescript
import { realm, Q } from 'alaq'

const app = realm('app', {
  origins: {
    counter: {
      count: 0,
      name: 'Counter',
      increment() { this.count++ }
    }
  }
})

// Расширение типов
declare module 'alaq' {
  interface Realms {
    app: {
      counter: {
        count: number
        name: string
        increment: () => void
      }
    }
  }
}

// TypeScript теперь знает все!
Q.ask('app.counter.count')     // → number
Q.tell('app.counter.count', 10) // ✅ number
Q.tell('app.counter.count', 'x') // ❌ Type error

Q.hear('app.counter.count', (value) => {
  // value: number (автовывод!)
  console.log(value.toFixed(2))
})

Q.call('app.counter.increment')  // ✅
Q.call('app.counter.invalid')    // ❌ Type error
```

### Извлечение типов

```typescript
import { ValueAt, ValidPaths, ValidActions } from 'alaq'

// Все валидные пути
type Paths = ValidPaths
// 'app.counter.count' | 'app.counter.name' | ...

// Все валидные действия
type Actions = ValidActions
// 'app.counter.increment' | ...

// Тип значения по пути
type CountType = ValueAt<'app.counter.count'>  // number
type NameType = ValueAt<'app.counter.name'>    // string
```

---

## Плагины стилей

### Создание кастомного стиля

```typescript
import { defineStyle } from 'alaq'

export const myStyle = defineStyle({
  name: 'game',

  methods: {
    loot: (core) => (path: string) => {
      console.log(`🎮 Looting ${path}`)
      return core.read(path)
    },

    equip: (core) => (path: string, value: any) => {
      console.log(`⚔️ Equipping ${path}`)
      core.write(path, value)
    },

    observe: (core) => (path: string, fn: Function) => {
      console.log(`👁️ Observing ${path}`)
      return core.subscribe(path, fn)
    },

    cast: (core) => (path: string, ...args: any[]) => {
      console.log(`✨ Casting ${path}`)
      return core.invoke(path, ...args)
    }
  }
})

// Расширение типов
declare module 'alaq' {
  interface Q {
    loot<P extends ValidPaths>(path: P): ValueAt<P>
    equip<P extends ValidPaths>(path: P, value: ValueAt<P>): void
    observe<P extends ValidPaths>(path: P, fn: Function): () => void
    cast<P extends ValidActions>(path: P, ...args: any[]): void
  }
}

// Использование
import { Q } from 'alaq'
import { myStyle } from './my-style'

Q.use(myStyle)

Q.loot('player.gold')
Q.equip('player.weapon', 'sword')
Q.observe('player.health', fn)
Q.cast('player.attack')
```

### Стиль с middleware

```typescript
export const loggingStyle = defineStyle({
  name: 'logging',

  middleware: {
    before: (operation, path, ...args) => {
      console.log(`[${operation}] ${path}`, args)
    },

    after: (operation, path, result) => {
      console.log(`[${operation}] ${path} →`, result)
    },

    error: (operation, path, error) => {
      console.error(`[${operation}] ${path} ✗`, error)
    }
  },

  methods: {
    ask: (core) => (path) => core.read(path),
    tell: (core) => (path, value) => core.write(path, value)
  }
})
```

### Стиль с расширениями

```typescript
export const extended = defineStyle({
  name: 'extended',

  methods: {
    // Базовые
    get: (core) => (path) => core.read(path),
    set: (core) => (path, value) => core.write(path, value),

    // Расширенные
    toggle: (core) => (path: string) => {
      const current = core.read(path)
      core.write(path, !current)
      return !current
    },

    increment: (core) => (path: string, by = 1) => {
      const current = core.read(path)
      const newValue = current + by
      core.write(path, newValue)
      return newValue
    },

    reset: (core) => (path: string, defaultValue = 0) => {
      core.write(path, defaultValue)
    }
  }
})

// Типизация с фильтрацией
type NumericPaths = {
  [P in ValidPaths]: ValueAt<P> extends number ? P : never
}[ValidPaths]

type BooleanPaths = {
  [P in ValidPaths]: ValueAt<P> extends boolean ? P : never
}[ValidPaths]

declare module 'alaq' {
  interface Q {
    toggle<P extends BooleanPaths>(path: P): boolean
    increment<P extends NumericPaths>(path: P, by?: number): number
    reset<P extends ValidPaths>(path: P, defaultValue?: any): void
  }
}

// Использование
Q.use(extended)

Q.toggle('user.authenticated')    // ✅ boolean
Q.toggle('counter.count')         // ❌ Type error: count is number

Q.increment('counter.count', 5)   // ✅ number
Q.increment('user.name', 5)       // ❌ Type error: name is string
```

---

## Примеры использования

### Простое приложение

```typescript
import { realm, Q, UnionModel } from 'alaq'
import { natural } from 'alaq/styles'

// Модели
class Counter extends UnionModel<'app'> {
  static modelName = 'counter'
  count = 0
  increment() { this.count++ }
  _count_up(v) { console.log('Count:', v) }
}

class User extends UnionModel<'app'> {
  static modelName = 'user'
  name = ''
  authenticated = false
  _authenticated_up(v) {
    console.log(v ? 'Logged in' : 'Logged out')
  }
}

// Создание realm
const app = realm('app')
app.origin('counter', Counter)
app.origin('user', User)

// Расширение типов
declare module 'alaq' {
  interface Realms {
    app: {
      counter: { count: number, increment: () => void }
      user: { name: string, authenticated: boolean }
    }
  }
}

// Использование
Q.use(natural)
Q.in('app')

Q.tell('counter.count', 10)
Q.tell('user.name', 'John')
Q.tell('user.authenticated', true)

Q.hear('counter.count', (count) => {
  console.log('Count is:', count)
})

Q.call('counter.increment')
```

### Множественные realms

```typescript
// App realm
const app = realm('com.company.app', {
  origins: {
    counter: { count: 0 }
  }
})

// Admin realm
const admin = realm('com.company.admin', {
  origins: {
    settings: { theme: 'dark' }
  }
})

// Работа с разными realms
Q.from('com.company.app').ask('counter.count')
Q.from('com.company.admin').ask('settings.theme')

// Или установка контекста
Q.in('com.company.app')
Q.ask('counter.count')

Q.in('com.company.admin')
Q.ask('settings.theme')

// Кросс-realm listeners
class Counter extends UnionModel<'com.company.app'> {
  count = 0

  _$admin:settings_theme_up(theme: string) {
    console.log('Admin theme changed:', theme)
  }
}
```

### Интеграция с Vue

```typescript
import { realm, Q } from 'alaq'
import { natural } from 'alaq/styles'
import { ref, computed, watch } from 'vue'

const app = realm('app', {
  origins: {
    counter: { count: 0, increment() { this.count++ } }
  }
})

Q.use(natural)
Q.in('app')

// Vue component
export default {
  setup() {
    // Reactive ref синхронизированный с Q
    const count = ref(Q.ask('counter.count'))

    Q.hear('counter.count', (v) => {
      count.value = v
    })

    watch(count, (newValue) => {
      Q.tell('counter.count', newValue)
    })

    const increment = () => {
      Q.call('counter.increment')
    }

    return { count, increment }
  }
}
```

---

## Открытые вопросы

### 1. Naming стилей

**Текущий:** ask/tell/hear/call

**Альтернативы:**
- get/give/watch/do
- seek/grant/witness/summon
- read/write/listen/invoke

**Решение:** Оставить гибкость через плагины, рекомендовать natural style

### 2. Factory models

**Проблема:** Как работать с множественными экземплярами?

**Вариант 1: Array-like paths**
```typescript
Q.ask('todos[0].title')
Q.tell('todos[1].completed', true)
```

**Вариант 2: Special API**
```typescript
Q.instance('todos', 1).ask('title')
Q.instance('todos', 2).tell('completed', true)
```

**Вариант 3: Factory methods**
```typescript
const todo1 = Q.create('todos', 1)
const todo2 = Q.create('todos', 2)

Q.ask('todos.1.title')
```

### 3. Батч операции

**Нужно ли:**
```typescript
Q.batch(() => {
  Q.tell('counter.count', 10)
  Q.tell('user.name', 'John')
  Q.tell('settings.theme', 'dark')
})
// → одно событие вместо трёх
```

### 4. Wildcard queries

**Нужно ли:**
```typescript
Q.ask('*.count')              // все count
Q.ask('app.counter.*')        // все свойства counter
Q.hear('app.**', fn)          // все изменения в app
```

---

**Версия:** v5.0.0-alpha
**Последнее обновление:** 2025-01-24
