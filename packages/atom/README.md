# @alaq/atom

> Проактивное управление состоянием через модели с автоматическим созданием nucleus для каждого свойства

Atom — это слой управления состоянием, построенный поверх `@alaq/nucleus`. Автоматически превращает класс или объект в проактивную модель, где каждое свойство становится nucleus.

## Установка

```bash
npm install @alaq/atom
```

## Основные концепции

- **Atom** — проактивная обертка над моделью/классом
- **Core** — доступ к nucleus каждого свойства (`atom.core.propertyName`)
- **State** — текущие значения всех свойств (`atom.state`)
- **Actions** — методы модели (`atom.actions`)

## Примеры использования

### Пример 1: Простая модель счетчика

```typescript
import { Atom } from '@alaq/atom'

class CounterModel {
  count = 0

  increment() {
    this.count++
  }

  decrement() {
    this.count--
  }
}

const counter = Atom({ model: CounterModel })

// Подписаться на изменения count
counter.core.count.up((value) => {
  console.log('Count:', value) // Count: 0
})

// Изменить значение напрямую
counter.core.count(5) // Count: 5

// Или через action
counter.actions.increment() // Count: 6

// Получить текущее состояние
console.log(counter.state.count) // 6
```

### Пример 2: Модель с вычисляемыми свойствами

```typescript
import { Atom } from '@alaq/atom'

class CartModel {
  items = []
  tax = 0.1

  get subtotal() {
    return this.items.reduce((sum, item) => sum + item.price, 0)
  }

  get total() {
    return this.subtotal * (1 + this.tax)
  }

  addItem(item) {
    this.items = [...this.items, item]
  }
}

const cart = Atom({ model: CartModel })

// Геттеры также становятся nucleus
cart.core.total.up((value) => {
  console.log('Total:', value)
})

cart.actions.addItem({ name: 'Book', price: 100 })
// Total: 110
```

### Пример 3: Сохранение состояния (LocalStorage)

```typescript
import { Atom, saved } from '@alaq/atom'

class SettingsModel {
  theme = saved('light') // Автоматически сохраняется в localStorage
  fontSize = saved(14)
  notifications = saved(true)
}

const settings = Atom({
  model: SettingsModel,
  name: 'app-settings', // Ключ для localStorage
  saved: '*' // Сохранять все свойства
})

// При изменении автоматически сохраняется
settings.core.theme('dark')

// При следующей загрузке значения восстановятся из localStorage
```

## Продвинутые возможности

### Теги и метаданные

```typescript
import { Atom, tag, saved, mixed } from '@alaq/atom'

class UserModel {
  id = tag.userId(null) // Добавить метаданные
  name = mixed(saved, tag.sync, 'John') // Комбинировать свойства
  email = saved('user@example.com')
}

const user = Atom({ model: UserModel })

// Доступ к метаданным
user.core.id.getMeta('tag') // 'userId'
```

### Создание упрощенного API

```typescript
import { coreAtom } from '@alaq/atom'

class Model {
  value = 0
  increment() { this.value++ }
}

// Прямой доступ к ядру (без .core)
const atom = coreAtom(Model)

atom.value.up((v) => console.log(v))
atom.increment()
```

## API

| Свойство | Описание |
|----------|----------|
| `atom.core` | Nucleus для каждого свойства |
| `atom.state` | Текущие значения свойств |
| `atom.actions` | Методы модели |
| `atom.bus` | Шина событий |
| `atom.known` | Метаинформация о свойствах |
| `atom.decay()` | Очистить память |

## Зависимости

Требует `@alaq/nucleus`

## Лицензия

TVR
