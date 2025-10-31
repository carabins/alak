# @alaq/next

Computed extensions for `@alaq/nucleus` - плагин для создания вычисляемых реактивных значений.

## Установка

```bash
npm install @alaq/nucleus @alaq/next
```

## Использование

### Базовое использование

```typescript
import { N, installPlugin } from '@alaq/nucleus'
import { ComputedPlugin } from '@alaq/next'

// Устанавливаем плагин
installPlugin(ComputedPlugin)

// Создаем источники данных
const firstName = N('John')
const lastName = N('Doe')

// Создаем вычисляемое значение
const fullName = N().from(firstName, lastName).weak((first, last) => {
  return `${first} ${last}`
})

console.log(fullName()) // "John Doe"

// Обновляем источники - вычисляемое значение обновится автоматически
firstName('Jane')
console.log(fullName()) // "Jane Doe"
```

### Стратегии вычисления

#### 1. Weak (слабая)

Вычисление происходит при любом изменении источников:

```typescript
const a = N(1)
const b = N(2)

const sum = N().from(a, b).weak((x, y) => x + y)

a(10) // sum пересчитается
b(20) // sum пересчитается снова
```

#### 2. Some (частичная)

Вычисление происходит при наличии хотя бы одного значения:

```typescript
const a = N() // пустой
const b = N(2)

// Вычислится сразу, т.к. b имеет значение
const result = N().from(a, b).some((x, y) => {
  return (x || 0) + (y || 0)
})

console.log(result()) // 2
```

#### 3. Strong (строгая)

Ленивое вычисление - происходит только при запросе значения:

```typescript
const a = N(1)
const b = N(2)

const product = N().from(a, b).strong((x, y) => {
  console.log('Computing...')
  return x * y
})

// Вычисление НЕ произошло

console.log(product()) // Logs: "Computing..." и возвращает 2
console.log(product()) // Возвращает 2 без повторного вычисления

a(10) // Пометит как "требует обновления"
console.log(product()) // Logs: "Computing..." и возвращает 20
```

### Асинхронные источники

Плагин поддерживает асинхронные источники:

```typescript
const userId = N(123)

const userData = N().from(userId).strong(async (id) => {
  const response = await fetch(`/api/users/${id}`)
  return response.json()
})

// При первом вызове вернет Promise
const data = await userData()
console.log(data) // { id: 123, name: "..." }
```

### Множественные источники

Можно комбинировать неограниченное количество источников:

```typescript
const price = N(100)
const quantity = N(2)
const tax = N(0.2)
const discount = N(0.1)

const total = N()
  .from(price, quantity, tax, discount)
  .weak((p, q, t, d) => {
    const subtotal = p * q
    const withTax = subtotal * (1 + t)
    const withDiscount = withTax * (1 - d)
    return withDiscount
  })

console.log(total()) // 216
```

## API

### `from(...sources)`

Создает вычисляемый nucleus из нескольких источников.

**Параметры:**
- `...sources: INucleus<any>[]` - исходные nucleus

**Возвращает:** объект со стратегиями вычисления

### Стратегии

- `.weak(fn)` - пересчитывает при каждом изменении источников
- `.some(fn)` - пересчитывает если есть хотя бы одно значение
- `.strong(fn)` - ленивое вычисление при запросе значения

## TypeScript

Плагин автоматически расширяет типы `INucleus`:

```typescript
import { N } from '@alaq/nucleus'
import { ComputedPlugin } from '@alaq/next'

installPlugin(ComputedPlugin)

const a = N(1)
const b = N(2)

// TypeScript знает про метод .from()
const sum = N().from(a, b).weak((x, y) => x + y)
//             ^^^^
// Автодополнение работает!
```

## Расширение типов вручную

Если хотите явно импортировать типы:

```typescript
/// <reference types="@alaq/next" />

import { N } from '@alaq/nucleus'

// Теперь .from() типизирован
const n = N()
n.from // ✅
```

## Примеры

### Валидация формы

```typescript
const email = N('')
const password = N('')

const isEmailValid = N()
  .from(email)
  .weak((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))

const isPasswordValid = N()
  .from(password)
  .weak((p) => p.length >= 8)

const isFormValid = N()
  .from(isEmailValid, isPasswordValid)
  .weak((e, p) => e && p)

isFormValid.up((valid) => {
  console.log('Form is valid:', valid)
})
```

### Фильтрация списка

```typescript
const items = N([
  { name: 'Apple', category: 'fruit' },
  { name: 'Carrot', category: 'vegetable' },
  { name: 'Banana', category: 'fruit' }
])

const filter = N('fruit')

const filteredItems = N()
  .from(items, filter)
  .weak((list, cat) => list.filter(item => item.category === cat))

console.log(filteredItems()) // [{ name: 'Apple', ... }, { name: 'Banana', ... }]

filter('vegetable')
console.log(filteredItems()) // [{ name: 'Carrot', ... }]
```

### Кеширование запросов

```typescript
const searchQuery = N('')

const searchResults = N()
  .from(searchQuery)
  .strong(async (query) => {
    if (!query) return []
    const response = await fetch(`/api/search?q=${query}`)
    return response.json()
  })

// Вызов произойдет только при реальном запросе значения
searchQuery('laptop')
const results = await searchResults() // Запрос к API
```

## Лицензия

TVR

## Автор

Gleb Panteleev
