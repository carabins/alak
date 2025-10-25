# Computed Values: Метод `.from()`

## Содержание

- [Введение](#введение)
- [Общая концепция](#общая-концепция)
- [Стратегии вычисления](#стратегии-вычисления)
  - [`.strong()` - строгая стратегия](#strong---строгая-стратегия)
  - [`.weak()` - слабая стратегия](#weak---слабая-стратегия)
  - [`.some()` - частичная стратегия](#some---частичная-стратегия)
- [Сравнение стратегий](#сравнение-стратегий)
- [Продвинутые паттерны](#продвинутые-паттерны)
- [Асинхронные вычисления](#асинхронные-вычисления)
- [Управление памятью](#управление-памятью)
- [Примеры использования](#примеры-использования)

---

## Введение

Метод `.from()` позволяет создавать **вычисляемые нуклоны** (computed nucleons) — реактивные значения, которые автоматически пересчитываются при изменении исходных нуклонов.

```typescript
import N from '@alaq/nucleus'

const firstName = N('Иван')
const lastName = N('Петров')

// Вычисляемое значение, которое автоматически обновляется
const fullName = N.from(firstName, lastName).strong((first, last) => {
  return `${first} ${last}`
})

console.log(fullName.value) // "Иван Петров"

firstName('Пётр')
console.log(fullName.value) // "Пётр Петров" - обновилось автоматически!
```

## Общая концепция

### Синтаксис

```typescript
N.from(...sources).strategy(computeFn)
```

- **sources** - один или несколько исходных нуклонов
- **strategy** - стратегия вычисления: `.strong()`, `.weak()`, или `.some()`
- **computeFn** - функция вычисления, принимает значения исходных нуклонов

### Основные характеристики

1. **Автоматическое отслеживание** - вычисляемый нуклон автоматически подписывается на изменения источников
2. **Ленивые вычисления** - пересчёт происходит только при изменении источников
3. **Управление памятью** - подписки автоматически очищаются при вызове `.decay()`
4. **Поддержка промисов** - работа с асинхронными значениями из коробки
5. **Цепочки вычислений** - вычисляемые нуклоны можно использовать как источники для других

### Свойство `.parents`

Все вычисляемые нуклоны имеют свойство `.parents` — массив исходных нуклонов:

```typescript
const a = N(1)
const b = N(2)
const sum = N.from(a, b).strong((x, y) => x + y)

console.log(sum.parents) // [a, b]
console.log(sum.parents[0] === a) // true
```

---

## Стратегии вычисления

### `.strong()` - строгая стратегия

**Когда использовать**: Когда для вычисления **необходимы все значения** и нет смысла вычислять с неполными данными.

#### Характеристики

- ✅ Ждёт, пока **все** источники будут иметь значения (не `undefined`)
- ✅ Использует **finite mode** по умолчанию (не пересчитывает при одинаковых значениях)
- ✅ Идеально для математических вычислений и комбинирования данных
- ❌ Не вычисляется с частичными данными

#### Базовый пример

```typescript
const price = N(100)
const quantity = N(2)
const discount = N(0.1)

const total = N.from(price, quantity, discount).strong((p, q, d) => {
  return p * q * (1 - d)
})

console.log(total.value) // 180 (100 * 2 * 0.9)

price(150)
console.log(total.value) // 270 (150 * 2 * 0.9)
```

#### Ожидание значений

```typescript
const a = N() // пустой нуклон
const b = N() // пустой нуклон

const sum = N.from(a, b).strong((x, y) => x + y)

console.log(sum.isEmpty) // true - не вычислился, ждёт значения

a(5)
console.log(sum.isEmpty) // true - всё ещё ждёт b

b(3)
console.log(sum.value) // 8 - вычислился когда оба значения есть
```

#### Finite mode (режим конечности)

По умолчанию `.strong()` не пересчитывает, если значения не изменились:

```typescript
let callCount = 0

const a = N(1)
const b = N(2)

const result = N.from(a, b).strong((x, y) => {
  callCount++
  return x + y
})

console.log(callCount) // 1 - вычислилось один раз

a(1) // то же значение
console.log(callCount) // 1 - не пересчитало

a(5) // новое значение
console.log(callCount) // 2 - пересчитало
```

#### Асинхронные источники

`.strong()` автоматически ждёт разрешения промисов:

```typescript
const asyncData = N()
const multiplier = N(2)

const result = N.from(asyncData, multiplier).strong((data, mult) => {
  return data * mult
})

console.log(result.isEmpty) // true

asyncData(Promise.resolve(10))
console.log(result.isAwaiting) // true - ждёт промис

// После разрешения промиса (автоматически):
// result.value === 20
```

---

### `.weak()` - слабая стратегия

**Когда использовать**: Когда нужно **всегда пересчитывать** при любом изменении, даже если значение не изменилось, но работать можно с `undefined`.

#### Характеристики

- ✅ Вычисляется **сразу** при создании (даже с `undefined`)
- ✅ Использует **finite mode** (не пересчитывает при одинаковых значениях)
- ✅ Работает с частичными данными (`undefined` значениями)
- ✅ Подходит для побочных эффектов и логирования

#### Базовый пример

```typescript
const a = N()
const b = N()

const result = N.from(a, b).weak((x, y) => {
  console.log('Вычисление:', x, y)
  return (x || 0) + (y || 0)
})

// Вызовется сразу:
// "Вычисление: undefined undefined"

a(5)
// "Вычисление: 5 undefined"
console.log(result.value) // 5

b(3)
// "Вычисление: 5 3"
console.log(result.value) // 8
```

#### Работа с undefined

```typescript
const data = N()
const results = []

const logger = N.from(data).weak((value) => {
  results.push({ value, timestamp: Date.now() })
  return value
})

console.log(results.length) // 1 - вызвался с undefined

data(10)
console.log(results.length) // 2
console.log(results[1].value) // 10
```

#### Finite mode

Даже с `.weak()`, если значение не изменилось - пересчёта не будет:

```typescript
let callCount = 0

const a = N(1)
const b = N(2)

const result = N.from(a, b).weak((x, y) => {
  callCount++
  return x + y
})

console.log(callCount) // 1

a(1) // то же значение
console.log(callCount) // 1 - не пересчитало (finite mode)

a(5) // новое значение
console.log(callCount) // 2 - пересчитало
```

---

### `.some()` - частичная стратегия

**Когда использовать**: Когда можно работать с **частичными данными** и нужно вычислять как только появится **хотя бы одно** значение.

#### Характеристики

- ✅ Вычисляется когда **хотя бы один** источник имеет значение
- ✅ Использует **finite mode** (не пересчитывает при одинаковых значениях)
- ✅ Идеально для постепенной загрузки данных
- ✅ Работает с `undefined` в функции вычисления

#### Базовый пример

```typescript
const firstName = N()
const lastName = N()

const fullName = N.from(firstName, lastName).some((first, last) => {
  return [first, last].filter(Boolean).join(' ')
})

console.log(fullName.isEmpty) // true - нет ни одного значения

firstName('Пётр')
console.log(fullName.value) // "Пётр" - вычислилось с одним значением

lastName('Петров')
console.log(fullName.value) // "Пётр Петров" - обновилось
```

#### Постепенная загрузка данных

```typescript
const userLoaded = N()
const avatarLoaded = N()
const postsLoaded = N()

const profileReady = N.from(userLoaded, avatarLoaded, postsLoaded).some((user, avatar, posts) => {
  return {
    hasUser: !!user,
    hasAvatar: !!avatar,
    hasPosts: !!posts,
    completeness: [user, avatar, posts].filter(Boolean).length / 3
  }
})

// Сразу после создания - не вычислится (нет значений)
console.log(profileReady.isEmpty) // true

userLoaded({ name: 'Иван' })
console.log(profileReady.value.completeness) // 0.33

avatarLoaded({ url: '/avatar.jpg' })
console.log(profileReady.value.completeness) // 0.66

postsLoaded([{ id: 1 }])
console.log(profileReady.value.completeness) // 1
```

#### Обработка опциональных полей

```typescript
const required = N('Основные данные')
const optional1 = N()
const optional2 = N()

const summary = N.from(required, optional1, optional2).some((req, opt1, opt2) => {
  const parts = [req]
  if (opt1) parts.push(opt1)
  if (opt2) parts.push(opt2)
  return parts.join(', ')
})

console.log(summary.value) // "Основные данные"

optional1('Дополнение 1')
console.log(summary.value) // "Основные данные, Дополнение 1"
```

---

## Сравнение стратегий

### Таблица различий

| Характеристика | `.strong()` | `.weak()` | `.some()` |
|---|---|---|---|
| **Вычисляется с undefined** | ❌ Ждёт все значения | ✅ Да | ⚠️ Если хотя бы 1 значение есть |
| **Вычисляется при создании** | ⚠️ Если все значения есть | ✅ Всегда | ⚠️ Если хотя бы 1 значение есть |
| **Finite mode** | ✅ Да | ✅ Да | ✅ Да |
| **Ожидание промисов** | ✅ Да | ✅ Да | ✅ Да |
| **Типичное использование** | Математика, комбинации | Эффекты, логи | Постепенная загрузка |

### Когда что использовать

```typescript
// STRONG - для вычислений, где нужны ВСЕ данные
const area = N.from(width, height).strong((w, h) => w * h)
const average = N.from(a, b, c).strong((x, y, z) => (x + y + z) / 3)

// WEAK - для эффектов и мониторинга
const logger = N.from(state).weak((s) => {
  console.log('State changed:', s)
  return s
})

// SOME - для UI с постепенной загрузкой
const displayName = N.from(firstName, lastName).some((f, l) => {
  if (f && l) return `${f} ${l}`
  if (f) return f
  if (l) return l
  return 'Аноним'
})
```

### Пример со всеми стратегиями

```typescript
const input = N()

// Strong - ждёт значение
const doubled = N.from(input).strong(x => x * 2)
console.log(doubled.isEmpty) // true

// Weak - вычисляется сразу
const logged = N.from(input).weak(x => {
  console.log('Input:', x) // "Input: undefined"
  return x
})

// Some - не вычисляется без значений
const display = N.from(input).some(x => x || 'N/A')
console.log(display.isEmpty) // true

input(5)
// doubled.value === 10
// logged.value === 5
// display.value === 5
```

---

## Продвинутые паттерны

### Цепочки вычислений

Вычисляемые нуклоны можно использовать как источники для других:

```typescript
const celsius = N(0)

const fahrenheit = N.from(celsius).strong(c => c * 9/5 + 32)
const kelvin = N.from(celsius).strong(c => c + 273.15)

const summary = N.from(celsius, fahrenheit, kelvin).strong((c, f, k) => {
  return `${c}°C = ${f}°F = ${k}K`
})

celsius(100)
console.log(summary.value)
// "100°C = 212°F = 373.15K"
```

### Множественные подписчики

Вычисляемые нуклоны - это обычные нуклоны, можно подписываться:

```typescript
const a = N(1)
const b = N(2)
const sum = N.from(a, b).strong((x, y) => x + y)

sum.up(value => console.log('Подписчик 1:', value))
sum.up(value => console.log('Подписчик 2:', value))

a(5)
// "Подписчик 1: 7"
// "Подписчик 2: 7"
```

### Трансформации данных

```typescript
const rawData = N([1, 2, 3, 4, 5])
const multiplier = N(2)

const processed = N.from(rawData, multiplier).strong((data, mult) => {
  return data.map(x => x * mult)
})

console.log(processed.value) // [2, 4, 6, 8, 10]

multiplier(3)
console.log(processed.value) // [3, 6, 9, 12, 15]
```

### Комбинирование объектов

```typescript
const user = N({ name: 'Иван', age: 30 })
const permissions = N({ canEdit: true, canDelete: false })
const session = N({ token: 'abc123', expires: Date.now() + 3600000 })

const context = N.from(user, permissions, session).strong((u, p, s) => ({
  user: u,
  permissions: p,
  session: s,
  isValid: s.expires > Date.now(),
  isAdmin: p.canEdit && p.canDelete
}))

console.log(context.value.isValid) // true
console.log(context.value.isAdmin) // false
```

### Условная логика

```typescript
const isLoading = N(true)
const data = N()
const error = N()

const state = N.from(isLoading, data, error).some((loading, d, err) => {
  if (loading) return { type: 'loading' }
  if (err) return { type: 'error', error: err }
  if (d) return { type: 'success', data: d }
  return { type: 'idle' }
})

console.log(state.value.type) // "loading"

isLoading(false)
data([1, 2, 3])
console.log(state.value.type) // "success"
```

---

## Асинхронные вычисления

### Асинхронные источники

`.from()` автоматически обрабатывает промисы в источниках:

```typescript
const asyncValue = N()
const syncValue = N(10)

const result = N.from(asyncValue, syncValue).strong((async, sync) => {
  return async + sync
})

asyncValue(Promise.resolve(5))

console.log(result.isAwaiting) // true - ждёт промис

// После разрешения (автоматически):
// result.value === 15
// result.isAwaiting === false
```

### Асинхронная функция вычисления

Функция вычисления может быть `async`:

```typescript
const url = N('/api/user')

const userData = N.from(url).strong(async (path) => {
  const response = await fetch(path)
  return await response.json()
})

url('/api/user/123')

console.log(userData.isAwaiting) // true - выполняется async функция

// После выполнения:
// userData.value === { id: 123, name: "..." }
```

### Множественные асинхронные источники

```typescript
const user = N()
const posts = N()
const comments = N()

const dashboard = N.from(user, posts, comments).strong((u, p, c) => ({
  userName: u.name,
  postsCount: p.length,
  commentsCount: c.length
}))

// Загрузка данных параллельно
user(fetch('/api/user').then(r => r.json()))
posts(fetch('/api/posts').then(r => r.json()))
comments(fetch('/api/comments').then(r => r.json()))

console.log(dashboard.isAwaiting) // true - ждёт все промисы

// Когда все разрешатся:
// dashboard.value === { userName: "...", postsCount: 10, commentsCount: 25 }
```

### Обработка ошибок в async

```typescript
const apiCall = N()

const result = N.from(apiCall).strong(async (url) => {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error('API Error')
    return await response.json()
  } catch (error) {
    return { error: error.message }
  }
})

apiCall('/api/data')
```

### Смешанные sync/async

```typescript
const syncData = N(100)
const asyncData = N()

const combined = N.from(syncData, asyncData).strong((sync, async) => {
  return sync + async
})

console.log(combined.isEmpty) // true - asyncData пустой

asyncData(Promise.resolve(50))
// Автоматически дождётся и вычислит:
// combined.value === 150
```

---

## Управление памятью

### Автоматическая очистка подписок

При вызове `.decay()` вычисляемый нуклон автоматически отписывается от источников:

```typescript
const a = N(1)
const b = N(2)

const sum = N.from(a, b).strong((x, y) => x + y)

console.log(a.haveListeners) // true - sum подписан на a
console.log(b.haveListeners) // true - sum подписан на b

sum.decay() // очистка

console.log(a.haveListeners) // false - подписка удалена
console.log(b.haveListeners) // false - подписка удалена
```

### Предотвращение утечек памяти

```typescript
function createDashboard(userStore, statsStore) {
  const dashboard = N.from(userStore, statsStore).strong((user, stats) => ({
    user,
    stats,
    lastUpdated: Date.now()
  }))

  // Вернуть с методом очистки
  return {
    data: dashboard,
    destroy: () => dashboard.decay()
  }
}

const dash = createDashboard(users, stats)

// Использование...

// Очистка при размонтировании компонента
dash.destroy()
```

### Проверка повторного использования `.from()`

Нельзя вызвать `.from()` дважды на одном нуклоне:

```typescript
const result = N()
result.from(a, b) // OK

result.from(c, d) // ❌ Error: "from nucleons already has a assigned"
```

### Использование с `using` (TC39 Explicit Resource Management)

```typescript
{
  using computed = N.from(source).strong(x => x * 2)

  // Использование computed...

} // Автоматически вызовется computed.decay()
```

---

## Примеры использования

### Пример 1: Корзина покупок

```typescript
const cart = N([
  { id: 1, price: 100, quantity: 2 },
  { id: 2, price: 50, quantity: 3 }
])
const discount = N(0) // 0-1
const tax = N(0.2) // 20%

const subtotal = N.from(cart).strong(items => {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0)
})

const discountAmount = N.from(subtotal, discount).strong((sub, disc) => {
  return sub * disc
})

const afterDiscount = N.from(subtotal, discountAmount).strong((sub, disc) => {
  return sub - disc
})

const taxAmount = N.from(afterDiscount, tax).strong((amount, rate) => {
  return amount * rate
})

const total = N.from(afterDiscount, taxAmount).strong((amount, tax) => {
  return amount + tax
})

console.log(subtotal.value) // 350
console.log(total.value) // 420 (350 * 1.2)

discount(0.1) // 10% скидка
console.log(total.value) // 378 ((350 - 35) * 1.2)
```

### Пример 2: Валидация формы

```typescript
const email = N('')
const password = N('')
const confirmPassword = N('')

const emailValid = N.from(email).strong(e => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
})

const passwordValid = N.from(password).strong(p => {
  return p.length >= 8
})

const passwordsMatch = N.from(password, confirmPassword).strong((p, c) => {
  return p === c && p.length > 0
})

const formValid = N.from(emailValid, passwordValid, passwordsMatch).strong((e, p, m) => {
  return e && p && m
})

const submitEnabled = N.from(formValid).strong(valid => valid)

// Использование в UI
submitEnabled.up(enabled => {
  document.querySelector('#submit').disabled = !enabled
})

email('user@example.com')
password('secret123')
confirmPassword('secret123')

console.log(submitEnabled.value) // true
```

### Пример 3: Реактивный поиск

```typescript
const searchQuery = N('')
const items = N([
  { id: 1, name: 'Яблоко', category: 'Фрукты' },
  { id: 2, name: 'Банан', category: 'Фрукты' },
  { id: 3, name: 'Морковь', category: 'Овощи' }
])
const selectedCategory = N()

const filtered = N.from(items, searchQuery, selectedCategory).some((list, query, cat) => {
  let result = list || []

  if (query) {
    const q = query.toLowerCase()
    result = result.filter(item => item.name.toLowerCase().includes(q))
  }

  if (cat) {
    result = result.filter(item => item.category === cat)
  }

  return result
})

console.log(filtered.value.length) // 3

searchQuery('ан')
console.log(filtered.value) // [{ id: 2, name: 'Банан', ... }]

selectedCategory('Фрукты')
console.log(filtered.value) // [{ id: 2, name: 'Банан', ... }]

searchQuery('')
console.log(filtered.value.length) // 2 (все фрукты)
```

### Пример 4: Состояние загрузки

```typescript
const isLoading = N(false)
const data = N()
const error = N()

const viewState = N.from(isLoading, data, error).some((loading, d, err) => {
  if (loading) return 'loading'
  if (err) return 'error'
  if (d) return 'success'
  return 'idle'
})

const canRetry = N.from(viewState).strong(state => {
  return state === 'error' || state === 'idle'
})

// Симуляция загрузки
async function loadData() {
  isLoading(true)
  error(undefined)

  try {
    const result = await fetch('/api/data')
    data(await result.json())
  } catch (e) {
    error(e.message)
  } finally {
    isLoading(false)
  }
}

viewState.up(state => {
  console.log('View state:', state)
})

loadData()
```

### Пример 5: Вычисление производных метрик

```typescript
const pageViews = N(1000)
const uniqueVisitors = N(750)
const bounceRate = N(0.4)
const avgSessionDuration = N(180) // секунды

const viewsPerVisitor = N.from(pageViews, uniqueVisitors).strong((views, visitors) => {
  return views / visitors
})

const engagementRate = N.from(bounceRate).strong(bounce => {
  return 1 - bounce
})

const qualityScore = N.from(viewsPerVisitor, engagementRate, avgSessionDuration).strong(
  (vpv, engagement, duration) => {
    // Сложная формула качества
    const normalizedDuration = Math.min(duration / 300, 1)
    return (vpv * 0.3 + engagement * 0.4 + normalizedDuration * 0.3) * 100
  }
)

const performanceGrade = N.from(qualityScore).strong(score => {
  if (score >= 80) return 'A'
  if (score >= 60) return 'B'
  if (score >= 40) return 'C'
  return 'D'
})

console.log(qualityScore.value) // ~54.4
console.log(performanceGrade.value) // "C"

// Улучшаем метрики
bounceRate(0.3)
avgSessionDuration(240)

console.log(performanceGrade.value) // "B"
```

### Пример 6: Кэширование с зависимостями

```typescript
const userId = N()
const cacheVersion = N(1)

const userDataCache = new Map()

const userData = N.from(userId, cacheVersion).strong((id, version) => {
  const cacheKey = `${id}-v${version}`

  if (userDataCache.has(cacheKey)) {
    console.log('Cache hit')
    return userDataCache.get(cacheKey)
  }

  console.log('Cache miss, loading...')
  const data = { id, name: `User ${id}`, loadedAt: Date.now() }
  userDataCache.set(cacheKey, data)
  return data
})

userId(123)
// "Cache miss, loading..."

userId(123)
// Не вызовется (finite mode - то же значение)

userId(456)
// "Cache miss, loading..." - новый пользователь

cacheVersion(2) // Инвалидация кэша
// "Cache miss, loading..." - новая версия
```

---

## Лучшие практики

### ✅ DO: Использовать правильную стратегию

```typescript
// Хорошо - strong для математики
const total = N.from(price, quantity).strong((p, q) => p * q)

// Хорошо - some для опциональных данных
const name = N.from(first, last).some((f, l) => [f, l].filter(Boolean).join(' '))
```

### ❌ DON'T: Побочные эффекты в вычислениях

```typescript
// Плохо - мутация в вычислении
const result = N.from(array).strong(arr => {
  arr.push(1) // ❌ Мутирует исходный массив!
  return arr
})

// Хорошо - иммутабельное преобразование
const result = N.from(array).strong(arr => {
  return [...arr, 1] // ✅ Создаёт новый массив
})
```

### ✅ DO: Очищать ресурсы

```typescript
// Хорошо
const computed = N.from(source).strong(x => x * 2)

// Когда больше не нужен
computed.decay()
```

### ❌ DON'T: Создавать циклические зависимости

```typescript
// Плохо - может привести к бесконечному циклу
const a = N(1)
const b = N.from(a).strong(x => x + 1)
// ❌ Не делать: a.up(v => b(v))
```

### ✅ DO: Использовать цепочки для сложной логики

```typescript
// Хорошо - разбито на шаги
const raw = N([1, 2, 3])
const filtered = N.from(raw).strong(arr => arr.filter(x => x > 1))
const mapped = N.from(filtered).strong(arr => arr.map(x => x * 2))
const sum = N.from(mapped).strong(arr => arr.reduce((a, b) => a + b, 0))
```

---

## Заключение

Метод `.from()` — мощный инструмент для создания реактивных вычислений в Nucleus:

- **`.strong()`** — для обязательных данных и математики
- **`.weak()`** — для эффектов и отладки
- **`.some()`** — для опциональных данных и постепенной загрузки

Выбор правильной стратегии делает код более предсказуемым и эффективным.
