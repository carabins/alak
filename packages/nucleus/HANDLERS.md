# Handlers API: Методы нуклонов

## Содержание

- [Введение](#введение)
- [Свойства (Props)](#свойства-props)
- [Подписки и слушатели](#подписки-и-слушатели)
- [Управление жизненным циклом](#управление-жизненным-циклом)
- [Фильтрованные подписки](#фильтрованные-подписки)
- [Конфигурация](#конфигурация)
- [Метаданные](#метаданные)
- [События](#события)
- [Геттеры и сеттеры](#геттеры-и-сеттеры)
- [Синхронизация (Tuning)](#синхронизация-tuning)
- [Контекст и привязка](#контекст-и-привязка)
- [Инъекция значений](#инъекция-значений)
- [Утилиты](#утилиты)
- [Символьные методы](#символьные-методы)

---

## Введение

Handlers - это набор методов, доступных для каждого нуклона. Они обеспечивают полный API для работы с реактивными контейнерами: подписки, управление жизненным циклом, конфигурацию и многое другое.

```typescript
import N from '@alaq/nucleus'

const n = N(10)

// Все эти методы доступны на любом нуклоне
n.up(value => console.log(value))
n.finite()
n.setId('myNucleon')
```

---

## Свойства (Props)

### `.isEmpty`

Проверяет, имеет ли нуклон значение.

```typescript
const n = N()
console.log(n.isEmpty) // true

n(10)
console.log(n.isEmpty) // false
```

**Когда использовать:**
- Проверка инициализации нуклона
- Условная логика в зависимости от наличия данных
- Валидация перед использованием значения

### `.isFilled`

Противоположность `.isEmpty` - проверяет наличие значения.

```typescript
const n = N(5)
console.log(n.isFilled) // true

n.clearValue()
console.log(n.isFilled) // false
```

### `.haveListeners`

Проверяет, есть ли активные подписчики.

```typescript
const n = N(1)
console.log(n.haveListeners) // false

n.up(v => console.log(v))
console.log(n.haveListeners) // true
```

**Применение:**
- Оптимизация - избежать вычислений если нет слушателей
- Отладка - проверка утечек памяти
- Условная логика в библиотеках

---

## Подписки и слушатели

### `.up(fn)`

Основной метод подписки на изменения. Вызывается **сразу** с текущим значением, затем при каждом изменении.

```typescript
const counter = N(0)

counter.up(value => {
  console.log('Значение:', value)
})
// Вывод: "Значение: 0"

counter(1)
// Вывод: "Значение: 1"
```

**Параметры:**
- `fn(value, nucleus)` - функция-слушатель
  - `value` - новое значение нуклона
  - `nucleus` - сам нуклон (опционально, если функция принимает 2 аргумента)

**Возвращает:** нуклон (для цепочек вызовов)

**Особенности:**
- Вызывается немедленно если значение уже есть
- Получает актуальное значение при каждом изменении
- Можно подписать несколько слушателей

```typescript
const n = N(10)

n.up(v => console.log('A:', v))
n.up(v => console.log('B:', v))

n(20)
// Вывод:
// "A: 10"
// "B: 10"
// "A: 20"
// "B: 20"
```

### `.down(fn)`

Отписывает слушателя.

```typescript
const n = N(1)

const listener = v => console.log(v)
n.up(listener)

n(2) // Вывод: 2

n.down(listener)
n(3) // Нет вывода
```

**Важно:** Передавайте ту же ссылку на функцию, что использовали в `.up()`:

```typescript
// ❌ Не работает - разные функции
n.up(v => console.log(v))
n.down(v => console.log(v))

// ✅ Работает - одна ссылка
const fn = v => console.log(v)
n.up(fn)
n.down(fn)
```

**Работает с grandListeners:**
```typescript
n.upTrue(fn)
n.down(fn) // Отпишет и от фильтрованной подписки
```

### `.next(fn)`

Подписывается на изменения **без** немедленного вызова с текущим значением.

```typescript
const n = N(5)

n.next(v => console.log('Next:', v))
// Нет вывода

n(10)
// Вывод: "Next: 10"
```

**Когда использовать:**
- Нужно реагировать только на изменения, не на текущее состояние
- Избежать дублирования логики при инициализации
- Подписка на события после первичной обработки

### `.once(fn)`

Подписывается на **одно** изменение. После первого вызова автоматически отписывается.

```typescript
const n = N()

n.once(v => console.log('Один раз:', v))

n(1) // Вывод: "Один раз: 1"
n(2) // Нет вывода
n(3) // Нет вывода
```

**С существующим значением:**
```typescript
const n = N(10)

n.once(v => console.log(v))
// Вывод: "10" (сразу)

n(20) // Нет вывода - уже отписался
```

**Применение:**
- Ожидание первой инициализации
- Разовая обработка события
- Lazy loading данных

### `.silent(value)`

Устанавливает значение **без** уведомления слушателей.

```typescript
const n = N(1)

n.up(v => console.log('Changed:', v))
// Вывод: "Changed: 1"

n.silent(10)
// Нет вывода

console.log(n.value) // 10
```

**Когда использовать:**
- Пакетные обновления
- Временное изменение без побочных эффектов
- Инициализация без запуска реакций

### `.curry()`

Возвращает функцию-сеттер, привязанную к нуклону.

```typescript
const count = N(0)

const increment = count.curry()
const setValue = count.curry()

increment(count.value + 1)
console.log(count.value) // 1

setValue(10)
console.log(count.value) // 10
```

**Применение:**
- Передача сеттера как callback
- Интеграция с формами
- Функциональное программирование

```typescript
// Пример с React
const MyComponent = () => {
  const name = N('')

  return <input onChange={e => name.curry()(e.target.value)} />
}
```

### `.resend()`

Повторно отправляет текущее значение всем слушателям.

```typescript
const n = N(5)
let count = 0

n.up(() => count++)
console.log(count) // 1

n.resend()
console.log(count) // 2

n.resend()
console.log(count) // 3
```

**Когда использовать:**
- Принудительное обновление компонентов
- Повторная валидация
- Синхронизация после внешних изменений

### `.mutate(mutatorFn)`

Изменяет значение через функцию-мутатор и уведомляет слушателей.

```typescript
const user = N({ name: 'Иван', age: 30 })

user.mutate(obj => {
  obj.age++
  return obj
})

console.log(user.value.age) // 31
```

**Применение:**
- Модификация объектов/массивов
- Инкременты/декременты
- Сложные трансформации

```typescript
const list = N([1, 2, 3])

list.mutate(arr => {
  arr.push(4)
  return arr
})

console.log(list.value) // [1, 2, 3, 4]
```

### `.is(value)`

Проверяет равенство текущего значения с переданным.

```typescript
const n = N(5)

console.log(n.is(5))    // true
console.log(n.is(10))   // false

const empty = N()
console.log(empty.is(undefined)) // true
```

**Применение:**
- Условная логика
- Валидация
- Сравнение состояний

---

## Управление жизненным циклом

### `.decay(silent?)`

Полная очистка нуклона: удаляет все подписки, значения и связи.

```typescript
const parent = N(10)
const child = N()

parent.up(child)
console.log(parent.haveListeners) // true

child.decay()

console.log(parent.haveListeners) // false
console.log(child.isEmpty) // true
```

**Параметры:**
- `silent` (boolean) - если `true`, не вызывает событие CLEAR

**Что очищает:**
1. Все обычные слушатели (`.listeners`)
2. Фильтрованные слушатели (`.grandListeners`)
3. Слушатели событий (`.stateListeners`)
4. Значение нуклона
5. Вызывает `decayHooks` и `risen` хуки
6. Удаляет мета-флаги

```typescript
const n = N(1)

n.up(() => {})
n.upTrue(() => {})
n.on('CUSTOM', () => {})

console.log(n.haveListeners) // true

n.decay()

console.log(n.isEmpty) // true
console.log(n.haveListeners) // false
```

**Важно для .from():**
```typescript
const a = N(1)
const b = N(2)
const sum = N.from(a, b).strong((x, y) => x + y)

sum.decay() // Автоматически отпишется от a и b
```

### `.clearValue()`

Удаляет только значение, не затрагивая подписки.

```typescript
const n = N(10)

n.up(v => console.log('Value:', v))

n.clearValue()
console.log(n.isEmpty) // true

n(20)
// Вывод: "Value: 20" - слушатель остался
```

**Отличие от `.decay()`:**
- `.clearValue()` - удаляет только значение, генерирует событие CLEAR
- `.decay()` - полная очистка, включая подписки

---

## Фильтрованные подписки

Специальные методы подписки с автоматической фильтрацией значений.

### `.upTrue(fn)`

Вызывается только когда значение **строго** `true`.

```typescript
const isActive = N(false)

isActive.upTrue(() => {
  console.log('Активировано!')
})

isActive(1)       // Нет вывода
isActive('true')  // Нет вывода
isActive(true)    // Вывод: "Активировано!"
```

**Применение:**
- Флаги активации
- Boolean состояния
- Триггеры действий

### `.upFalse(fn)`

Вызывается только когда значение **строго** `false`.

```typescript
const isLoading = N(true)

isLoading.upFalse(() => {
  console.log('Загрузка завершена')
})

isLoading(0)      // Нет вывода
isLoading('')     // Нет вывода
isLoading(false)  // Вывод: "Загрузка завершена"
```

### `.upSome(fn)`

Вызывается для любых **truthy** значений (все кроме `false`, `0`, `''`, `null`, `undefined`, `NaN`).

```typescript
const data = N()

data.upSome(value => {
  console.log('Есть данные:', value)
})

data(null)        // Нет вывода
data(0)           // Нет вывода
data('')          // Нет вывода
data(1)           // Вывод: "Есть данные: 1"
data('text')      // Вывод: "Есть данные: text"
data([])          // Вывод: "Есть данные: []"
```

**Применение:**
- Реакция на появление данных
- Фильтрация пустых значений
- Условный рендеринг

### `.upSomeFalse(fn)`

Вызывается для любых **falsy** значений.

```typescript
const error = N()

error.upSomeFalse(err => {
  console.log('Ошибка или пусто')
})

error(null)       // Вывод
error(0)          // Вывод
error('')         // Вывод
error(false)      // Вывод
error('error')    // Нет вывода
```

### `.upNone(fn)`

Вызывается только для `null` или `undefined`.

```typescript
const selected = N()

selected.upNone(() => {
  console.log('Ничего не выбрано')
})

selected(0)         // Нет вывода
selected(false)     // Нет вывода
selected(null)      // Вывод: "Ничего не выбрано"
selected(undefined) // Вывод: "Ничего не выбрано"
```

**Применение:**
- Сброс выбора
- Очистка форм
- Обработка отсутствующих данных

### `.upDown(fn)`

Особый тип подписки - получает и **предыдущее**, и **новое** значение.

```typescript
const status = N('idle')

status.upDown((prevValue, newValue) => {
  console.log(`${prevValue} → ${newValue}`)
})

status('loading')
// Вывод: "idle → loading"

status('success')
// Вывод: "loading → success"
```

**Параметры функции:**
- `prevValue` - предыдущее значение
- `newValue` - новое значение

**Применение:**
- Анимации переходов
- Логирование изменений
- Undo/Redo системы
- Аналитика

---

## Конфигурация

### `.finite(enabled?)`

Включает режим конечности - нуклон не уведомляет о повторных установках того же значения.

```typescript
const n = N(1)
let count = 0

n.up(() => count++)
console.log(count) // 1

n(1) // То же значение
console.log(count) // 2 - вызвался

n.finite()

n(1) // То же значение
console.log(count) // 2 - НЕ вызвался (finite mode)

n(2) // Новое значение
console.log(count) // 3 - вызвался
```

**Параметры:**
- Без аргументов - включает finite mode
- `true` - включает
- `false` - выключает

**Применение:**
- Оптимизация рендеринга
- Избежать лишних вычислений
- Дедупликация событий

**По умолчанию в `.from().strong()`:**
```typescript
const sum = N.from(a, b).strong((x, y) => x + y)
// finite mode уже включен
```

### `.holistic(enabled?)`

Режим "целостности" - нуклон хранит и передаёт множественные аргументы.

```typescript
const coords = N().holistic()

coords.up((...args) => {
  console.log('Координаты:', args)
})

coords(10, 20)
// Вывод: "Координаты: [10, 20]"

coords(30, 40, 50)
// Вывод: "Координаты: [30, 40, 50]"
```

**Применение:**
- Множественные параметры
- Координаты, точки
- Функциональные аргументы

```typescript
const point = N().holistic()

point(100, 200)
const [x, y] = point.value
console.log(x, y) // 100, 200
```

### `.stateless(enabled?)`

Режим без состояния - нуклон не хранит значение, только передаёт события.

```typescript
const event = N().stateless()

console.log(event.isEmpty) // true

event.up(data => {
  console.log('Событие:', data)
})

event('click')
// Вывод: "Событие: click"

console.log(event.isEmpty) // true - значение не сохранилось
```

**Параметры:**
- Без аргументов или `true` - включает stateless, очищает текущее значение
- `false` - выключает

**Применение:**
- События (клики, движения мыши)
- Команды
- Шина сообщений

```typescript
const mouseClick = N().stateless()

mouseClick.up(({ x, y }) => {
  console.log(`Клик на ${x}, ${y}`)
})

document.addEventListener('click', e => {
  mouseClick({ x: e.clientX, y: e.clientY })
})
```

### `.setId(id)`

Устанавливает ID нуклона.

```typescript
const user = N({ name: 'Иван' })
user.setId('currentUser')

console.log(user.id) // "currentUser"
```

**Применение:**
- Идентификация в коллекциях
- Отладка
- Логирование
- `.injectTo()` использует ID как ключ

### `.setName(name)`

Устанавливает имя нуклона.

```typescript
const counter = N(0)
counter.setName('clickCounter')

console.log(counter.name) // "clickCounter"
```

**Приоритет в `.injectTo()`:**
name > id > uid

---

## Метаданные

Система хранения произвольных метаданных на нуклоне.

### `.addMeta(key, value?)`

Добавляет метаданные.

```typescript
const user = N({ name: 'Иван' })

user.addMeta('role', 'admin')
user.addMeta('permissions', ['read', 'write'])
user.addMeta('timestamp')
```

**Параметры:**
- `key` (string) - ключ метаданных
- `value` (any, optional) - значение (если не указано, сохранится `null`)

**Применение:**
- Дополнительная информация о нуклоне
- Флаги и настройки
- Метаинформация для фреймворков

### `.getMeta(key)`

Получает метаданные.

```typescript
const role = user.getMeta('role')
console.log(role) // "admin"

const missing = user.getMeta('nonexistent')
console.log(missing) // null
```

**Возвращает:**
- Значение если ключ существует
- `null` если ключа нет или metaMap не инициализирована

### `.hasMeta(key)`

Проверяет наличие метаданных.

```typescript
console.log(user.hasMeta('role'))        // true
console.log(user.hasMeta('nonexistent')) // false
```

### `.deleteMeta(key)`

Удаляет метаданные.

```typescript
const result = user.deleteMeta('role')
console.log(result) // true - успешно удалено

const result2 = user.deleteMeta('role')
console.log(result2) // false - уже не существует
```

**Возвращает:**
- `true` если метаданные были удалены
- `false` если ключ не существовал

### Пример использования

```typescript
const nucleus = N(100)

// Добавляем метаинформацию
nucleus.addMeta('type', 'counter')
nucleus.addMeta('min', 0)
nucleus.addMeta('max', 1000)
nucleus.addMeta('step', 10)

// Используем в логике
function increment(n) {
  const step = n.getMeta('step') || 1
  const max = n.getMeta('max') || Infinity

  const newValue = n.value + step
  if (newValue <= max) {
    n(newValue)
  }
}

increment(nucleus) // 110
```

---

## События

Система пользовательских событий для нуклонов.

### `.on(eventName, handler)`

Подписывается на событие.

```typescript
const n = N(1)

n.on('CUSTOM_EVENT', (data) => {
  console.log('Событие:', data)
})

n.dispatch('CUSTOM_EVENT', { message: 'Hello' })
// Вывод: "Событие: { message: 'Hello' }"
```

**Системные события:**
- `CLEAR` - очистка значения
- `AWAIT` - начало/конец ожидания промиса

### `.off(eventName, handler)`

Отписывается от события.

```typescript
const handler = (data) => console.log(data)

n.on('MY_EVENT', handler)
n.off('MY_EVENT', handler)
```

### `.dispatch(eventName, ...values)`

Генерирует событие.

```typescript
const eventBus = N()

eventBus.on('USER_LOGIN', (userId, timestamp) => {
  console.log(`User ${userId} logged in at ${timestamp}`)
})

eventBus.dispatch('USER_LOGIN', 123, Date.now())
```

### `.onClear(handler)` / `.offClear(handler)`

Удобные методы для подписки на событие очистки.

```typescript
const data = N([1, 2, 3])

data.onClear(() => {
  console.log('Данные очищены')
})

data.clearValue()
// Вывод: "Данные очищены"
```

### `.onAwait(handler)` / `.offAwait(handler)`

Подписка на начало/конец ожидания промиса.

```typescript
const asyncData = N()

asyncData.onAwait((isAwaiting) => {
  console.log(isAwaiting ? 'Загрузка...' : 'Готово')
})

asyncData(fetch('/api/data')) // "Загрузка..."
// После разрешения промиса: "Готово"
```

**Применение:**
- Индикаторы загрузки
- Обработка асинхронных операций
- UI состояния

---

## Геттеры и сеттеры

### `.setGetter(fn, isAsync?)`

Устанавливает функцию-геттер для ленивого вычисления.

```typescript
const expensive = N()

expensive.setGetter(() => {
  console.log('Вычисляем...')
  return Math.random() * 1000
})

const val1 = expensive() // "Вычисляем..." → возвращает число
const val2 = expensive() // "Вычисляем..." → новое число
```

**Параметры:**
- `fn` - функция вычисления
- `isAsync` (boolean) - является ли функция асинхронной

**Применение:**
- Lazy evaluation
- Динамические значения
- Вычисляемые свойства

```typescript
const now = N()
now.setGetter(() => Date.now())

setInterval(() => {
  console.log('Текущее время:', now())
}, 1000)
```

### `.setOnceGet(fn, isAsync?)`

Геттер, который вычисляется **один раз**, затем удаляется.

```typescript
const config = N()

config.setOnceGet(() => {
  console.log('Загрузка конфига...')
  return { theme: 'dark', lang: 'ru' }
})

const cfg1 = config() // "Загрузка конфига..." → { theme: 'dark', lang: 'ru' }
const cfg2 = config() // { theme: 'dark', lang: 'ru' } (без вывода)
```

**Применение:**
- Одноразовая инициализация
- Загрузка конфигурации
- Singleton паттерн

### `.setWrapper(fn, isAsync?)`

Устанавливает функцию-обёртку для трансформации значений при установке.

```typescript
const rounded = N()

rounded.setWrapper((newValue, oldValue) => {
  return Math.round(newValue)
})

rounded(3.7)
console.log(rounded.value) // 4

rounded(5.2)
console.log(rounded.value) // 5
```

**Параметры функции:**
- `newValue` - новое устанавливаемое значение
- `oldValue` - предыдущее значение

**Применение:**
- Валидация входных данных
- Форматирование значений
- Ограничение диапазонов

```typescript
const bounded = N(50)

bounded.setWrapper((val) => {
  return Math.max(0, Math.min(100, val))
})

bounded(150)
console.log(bounded.value) // 100

bounded(-20)
console.log(bounded.value) // 0
```

---

## Синхронизация (Tuning)

### `.tuneTo(targetNucleus)`

Синхронизирует текущий нуклон с другим - значения автоматически копируются.

```typescript
const source = N(10)
const target = N()

target.tuneTo(source)

console.log(target.value) // 10

source(20)
console.log(target.value) // 20
```

**Применение:**
- Зеркалирование состояния
- Кэширование
- Синхронизация UI элементов

```typescript
const masterVolume = N(50)
const displayVolume = N()
const sliderVolume = N()

displayVolume.tuneTo(masterVolume)
sliderVolume.tuneTo(masterVolume)

masterVolume(75)
console.log(displayVolume.value) // 75
console.log(sliderVolume.value)  // 75
```

### `.tuneOff()`

Отключает синхронизацию.

```typescript
target.tuneTo(source)

source(30)
console.log(target.value) // 30

target.tuneOff()

source(40)
console.log(target.value) // 30 (не изменилось)
```

---

## Контекст и привязка

### `.bind(context)`

Привязывает контекст к нуклону.

```typescript
const n = N(10)
const ctx = { name: 'MyContext' }

n.bind(ctx)
console.log(n._context === ctx) // true
```

**Применение:**
- Привязка к компонентам
- Scope управление
- Интеграция с фреймворками

### `.apply(context, [value])`

Устанавливает контекст и значение (аналог `Function.prototype.apply`).

```typescript
const n = N()
const ctx = { name: 'Context' }

n.apply(ctx, [42])

console.log(n.value) // 42
console.log(n._context) // { name: 'Context' }
```

### `.call(context, ...values)`

Устанавливает контекст и значения (аналог `Function.prototype.call`).

```typescript
const n = N().holistic()

n.call(null, 1, 2, 3)
console.log(n.value) // [1, 2, 3]
```

---

## Инъекция значений

### `.injectTo(object, key?)`

Инъецирует значение нуклона в объект.

```typescript
const user = N({ name: 'Иван', age: 30 })
user.setId('currentUser')

const state = {}
user.injectTo(state)

console.log(state.currentUser) // { name: 'Иван', age: 30 }
```

**Параметры:**
- `object` - целевой объект (обязательный)
- `key` - ключ для инъекции (опциональный)

**Приоритет ключа:**
1. Переданный `key`
2. `._name` (установленный через `.setName()`)
3. `.id` (установленный через `.setId()`)
4. `.uid` (автоматический уникальный ID)

```typescript
const n = N(100)
n.setName('myValue')
n.setId('valueId')

const obj = {}

// Использует name (наивысший приоритет)
n.injectTo(obj)
console.log(obj.myValue) // 100

// Явный ключ (переопределяет всё)
n.injectTo(obj, 'custom')
console.log(obj.custom) // 100
```

**Исключения:**
```typescript
const n = N(1)
n.injectTo(null) // Throws: "trying inject quark to null object"
```

**Применение:**
- Экспорт состояния
- Серializация
- Интеграция с внешними библиотеками

---

## Утилиты

### `.cloneValue()`

Создаёт глубокую копию значения через JSON.

```typescript
const original = N({ a: 1, b: { c: 2 } })
const cloned = original.cloneValue()

cloned.b.c = 999

console.log(original.value.b.c) // 2 (не изменилось)
console.log(cloned.b.c) // 999
```

**Ограничения:**
- Не клонирует функции
- Не клонирует Date, RegExp, Set, Map (конвертирует в объекты)
- Циклические ссылки вызовут ошибку

**Применение:**
- Snapshot состояния
- Undo/Redo
- Сравнение версий

### `.toString()`

Возвращает строковое представление нуклона.

```typescript
const n = N(10)
console.log(n.toString()) // "nucleon:123456" (где 123456 - uid)
```

### `.valueOf()`

Возвращает примитивное значение (строка с uid).

```typescript
const n = N(5)
console.log(n.valueOf()) // "nucleon:123456"
```

---

## Символьные методы

### `Symbol.toPrimitive`

Автоматическое приведение к примитиву.

```typescript
const n = N(10)

// При приведении к строке/числу
const str = String(n)  // "nucleon:123456"
```


**Применение:**
- Автоматическая очистка ресурсов
- RAII паттерн в JavaScript
- Управление жизненным циклом

---

## Дополнительные методы

### `.parentFor(childNucleus, name)`

Устанавливает текущий нуклон как родителя для дочернего.

```typescript
const parent = N(10)
const child = N()

parent.parentFor(child, 'source')

// parent автоматически обновляет child
parent(20)
```

**Внутреннее использование:**
- Система зависимостей
- `.from()` использует этот механизм
- Графы реактивности

---

## Заключение

Handlers предоставляют мощный и гибкий API для работы с нуклонами:

- **Подписки** - `.up()`, `.down()`, `.next()`, `.once()`
- **Фильтры** - `.upTrue()`, `.upSome()`, `.upNone()` и др.
- **Конфигурация** - `.finite()`, `.holistic()`, `.stateless()`
- **Жизненный цикл** - `.decay()`, `.clearValue()`
- **События** - `.on()`, `.dispatch()`
- **Утилиты** - `.cloneValue()`, `.injectTo()`, `.tuneTo()`

Правильное использование этих методов позволяет создавать эффективные и поддерживаемые реактивные системы.
