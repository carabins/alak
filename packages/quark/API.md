# Quark API Specification

Компактная высокопроизводительная реактивная система с мощным плагином и встроенной шиной событий.

---

## Конструктор

### `Qu(options?)`

Создаёт новый кварк - реактивный контейнер.

```typescript
const counter = Qu()              // Пустое значение (undefined)
const counter = Qu({              // С начальным значением
  value: 0
})
const counter = Qu({              // С полными опциями
  value: 0,
  realm: 'counters',
  id: 'main-counter',
  dedup: true,
  stateless: false,
  pipe: (value) => value > 0 ? value : undefined
})
```

**Параметры:**
- `options?` - Опции конфигурации:
  - `value?: T` - Начальное значение
  - `realm?: string` - Realm для quantum bus (по умолчанию без realm)
  - `id?: string` - Уникальный идентификатор кварка
  - `dedup?: boolean` - Дедупликация значений (не уведомлять если значение не изменилось)
  - `stateless?: boolean` - Не сохранять значение в quark.value (только уведомления)
  - `pipe?: (value: T) => T | undefined` - Функция трансформации/валидации значения

**Возвращает:** Callable quark объект

---

### `Qv(value?, options?)`

Alias для удобного создания кварка со значением.

```typescript
const counter = Qv(0)             // Короткий синтаксис
const counter = Qv(0, {           // Со значением + опции
  realm: 'counters',
  id: 'main-counter',
  dedup: true
})
```

**Параметры:**
- `value?` - Начальное значение
- `options?` - Опции конфигурации (без поля `value`)

**Возвращает:** Callable quark объект

**Эквивалентность:**
```typescript
Qv(0, {realm: 'counters'})
// то же что
Qu({value: 0, realm: 'counters'})
```

---

## Основные операции

### Get/Set значения

```typescript
const value = counter()           // Получить значение
counter(10)                       // Установить значение
```

Кварк - это функция. Вызов без аргументов возвращает значение, с аргументом - устанавливает.

**Особенности:**
- При первой установке значения в realm эмитится событие `QUARK_AWAKE`
- Если установлен `dedup: true`, уведомления не будут отправлены если значение не изменилось
- Если установлен `stateless: true`, значение не сохраняется в `quark.value`
- Если установлен `pipe`, значение проходит через функцию перед установкой

---

## Подписки на изменения

### `quark.up(listener)`

Подписка на изменение значения (вызывается при каждом изменении).

```typescript
counter.up((value, quark) => {
  console.log('New value:', value)
  console.log('Quark id:', quark.id)
})
```

**Параметры:**
- `listener: (value: T, quark: Quark<T>) => void` - Функция-слушатель
  - `value` - Новое значение
  - `quark` - Ссылка на сам кварк (для доступа к id, realm, emit и т.д.)

**Возвращает:** `quark` (для chaining)

**Особенности:**
- Вызывается при каждой установке значения через `quark(value)`
- Listener всегда получает оба аргумента (value, quark)
- Если quark не нужен, просто не используйте второй параметр
- Не вызывается при инициализации, только при реальных изменениях
- Lazy initialization - структуры создаются только при первой подписке

---

### `quark.down(listener)`

Отписка от изменений.

```typescript
const listener = (value) => console.log(value)
counter.up(listener)
counter.down(listener)
```

**Параметры:**
- `listener: Function` - Функция, которую нужно отписать

**Возвращает:** `quark` (для chaining)

---

### `quark.silent(fn)`

Выполнить функцию без триггера listeners.

```typescript
counter.silent(() => {
  counter(100)  // Listeners не будут вызваны
})
```

**Параметры:**
- `fn: () => void` - Функция для выполнения

**Возвращает:** `quark` (для chaining)

**Применение:**
- Инициализация без уведомлений
- Batch updates
- Избежание циклических зависимостей

---

## События (Event Bus)

### `quark.on(event, listener)`

Подписка на событие.

```typescript
// Локальное событие
counter.on('increment', (data) => {
  console.log('Incremented:', data)
})

// Cross-realm событие (если у кварка есть realm)
counter.on('timers:tick', (data) => {
  console.log('Timer tick from another realm')
})

// Wildcard: все события текущего realm
counter.on('*', (data) => {
  console.log('Any event:', data.event, data.data)
})

// Wildcard: все события всех realms
counter.on('*:*', (data) => {
  console.log('Global event:', data.realm, data.event, data.data)
})
```

**Форматы событий:**
- `'eventName'` - Локальное событие кварка
- `'realm:eventName'` - Событие из указанного realm (cross-realm)
- `'*'` - Все события текущего realm (только если у кварка есть realm)
- `'*:*'` - Все события всех realms (глобальный wildcard)

**Параметры listener:**
- Для локальных событий: `{id, value, data}`
- Для realm событий: `{id, value, data}` (из realm bus)
- Для `'*'`: `{event, data}` (только события текущего realm)
- Для `'*:*'`: `{realm, event, data}` (все события)

**Возвращает:** `quark` (для chaining)

---

### `quark.off(event, listener)`

Отписка от события.

```typescript
const listener = (data) => console.log(data)
counter.on('increment', listener)
counter.off('increment', listener)
```

**Возвращает:** `quark` (для chaining)

---

### `quark.once(event, listener)`

Подписка на событие (одноразовая).

```typescript
counter.once('ready', () => {
  console.log('Ready!')
})
```

**Возвращает:** `quark` (для chaining)

---

### `quark.emit(event, data?)`

Отправить событие.

```typescript
counter.emit('increment', {delta: 1})
```

**Поведение:**
- Локально: вызывает слушатели `quark.on(event, ...)`
- Realm: если у кварка есть realm, отправляет в quantum bus как `realm:event`
- Данные события: `{id: quark.id, value: quark.value, data: переданные_данные}`

**Возвращает:** `quark` (для chaining)

---

### `quark.clear()`

Очистить все listeners и события.

```typescript
counter.clear()
```

**Возвращает:** `quark` (для chaining)

---

### `quark.decay()`

Уничтожить кварк (очистка + опционально в pool).

```typescript
counter.decay()
```

В будущем может использоваться для object pooling.

---

## Трансформация и валидация

### `quark.pipe(fn)`

Установить функцию трансформации/валидации значения.

```typescript
// Guard (валидация)
counter.pipe((value) => {
  if (value < 0) return undefined  // Отклонить значение
  return value
})

// Modifier (трансформация)
counter.pipe((value) => value * 2)

// Guard + Modifier
counter.pipe((value) => {
  if (value < 0) return undefined
  return Math.round(value)
})

// Chaining
counter
  .pipe((v) => v > 0 ? v : undefined)  // Последний вызов перезаписывает
```

**Параметры:**
- `fn: (value: T) => T | undefined`
  - Если возвращает `undefined` - значение отклоняется (guard)
  - Если возвращает новое значение - оно используется (modifier)

**Возвращает:** `quark` (для chaining)

**Особенности:**
- Вызывается перед установкой значения
- Может отклонить значение (вернуть undefined)
- Может модифицировать значение
- Используется плагинами для расширения функциональности

---

## Конфигурация

### `quark.dedup(enable?)`

Включить/выключить дедупликацию.

```typescript
counter.dedup()        // Включить (по умолчанию)
counter.dedup(true)    // Включить
counter.dedup(false)   // Выключить
```

**Поведение:**
- Если включено: listeners не вызываются если `newValue === oldValue`
- Использует строгое сравнение (`===`)

**Возвращает:** `quark` (для chaining)

---

### `quark.stateless(enable?)`

Включить/выключить stateless режим.

```typescript
counter.stateless()       // Включить (по умолчанию)
counter.stateless(true)   // Включить
counter.stateless(false)  // Выключить
```

**Поведение:**
- Если включено: значение не сохраняется в `quark.value`
- Listeners всё равно вызываются
- Используется для pure event bus паттерна

**Возвращает:** `quark` (для chaining)

---

## Quantum Bus (Internal)

Внутренняя глобальная шина событий для коммуникации между realms.

**Доступ через кварки:**
- Кварки с realm автоматически подключены к quantum bus
- Используйте `quark.on('realm:event')` для cross-realm подписки
- Используйте `quark.on('*:*')` для подписки на все realms
- Прямой доступ к quantum bus не предоставляется в публичном API

---

## Системные события

### `QUARK_AWAKE`

Автоматически эмитится в realm при первой установке значения.

```typescript
const counter = Qu({realm: 'counters', id: 'main'})
const logger = Qu({realm: 'logs'})

// Подписка на QUARK_AWAKE из другого кварка
logger.on('counters:QUARK_AWAKE', (data) => {
  console.log('Quark awake:', data.id, data.value)
})

counter(10)  // → QUARK_AWAKE {id: 'main', value: 10, quark}
counter(20)  // → QUARK_AWAKE не эмитится (уже был awake)
```

**Данные события:**
```typescript
{
  id: string,      // quark.id
  value: any,      // Установленное значение
  quark: Quark     // Ссылка на кварк
}
```

**Условия:**
- Эмитится только если у кварка есть `realm`
- Эмитится только при первой установке значения (флаг `WAS_SET`)
- Не эмитится при инициализации в конструкторе

---

### `change`

Автоматически эмитится при изменении значения (если есть слушатели).

```typescript
counter.on('change', (data) => {
  console.log('Changed:', data.value)
})

counter(10)  // → change event
```

**Данные события:**
```typescript
{
  id: string,      // quark.id
  value: any       // Новое значение
}
```

**Особенности:**
- Эмитится локально (в кварк)
- Эмитится в realm bus (если есть realm и есть слушатели)
- Оптимизация: проверяется `_eventCounts.change` перед emit

---

## Внутренние свойства

Доступны для продвинутого использования (plugins):

```typescript
quark.uid           // number - уникальный счётчик (internal)
quark.value         // any - текущее значение
quark.id            // string | undefined - пользовательский id
quark._flags        // number - bit flags состояния
quark._realm        // string | undefined - realm name
quark._realmPrefix  // string | undefined - realm + ':'
quark.listeners     // Set<Function> | null - lazy init
quark._events       // Map<string, Set<Function>> | null - lazy init
quark._eventCounts  // Record<string, number> | null - lazy init
quark._pipeFn       // Function | null - pipe function
quark._wildcardListeners // Set<Function> | null - wildcard '*' listeners
```

---

## Bit Flags

Используются для оптимизации проверок (O(1)):

```typescript
HAS_LISTENERS = 1   // 0001 - есть up/down listeners
HAS_EVENTS = 2      // 0010 - есть event listeners
HAS_REALM = 4       // 0100 - кварк принадлежит realm
WAS_SET = 8         // 1000 - значение было установлено
DEDUP = 16          // 0001 0000 - дедупликация включена
STATELESS = 32      // 0010 0000 - не хранить значение
```

Проверка:
```typescript
if (quark._flags & HAS_LISTENERS) {
  // есть listeners
}

if (quark._flags === WAS_SET) {
  // только WAS_SET, без listeners/events/realm (fast path)
}
```

---

## Оптимизации производительности

Текущая реализация использует:

1. **Lazy Initialization** - структуры создаются только когда нужны
2. **Bit Flags** - O(1) проверки состояния вместо множественных if
3. **Event Counts Cache** - O(1) проверка `hasListeners(event)`
4. **Fast Paths** - оптимизированные ветки для частых случаев
5. **Function + Prototype** - 7.6x быстрее чем Proxy

Планируемые оптимизации (см. PERFORMANCE.md):
- Monomorphic shapes
- Inline listeners array (вместо Set)
- Pre-allocated event data
- Object pooling
- Remove setPrototypeOf

**Текущий baseline:** 3ms для 100k операций
**Цель:** <2ms для 100k операций

---

## Система плагинов

Плагины могут:
- Добавлять методы в прототип
- Добавлять свойства
- Расширять pipe функциональность
- Подписываться на системные события

Спецификация плагинов будет добавлена после завершения core API.

---

## TypeScript типы

```typescript
type Listener<T> = (value: T, quark: Quark<T>) => void

type EventData = {
  id?: string
  value?: any
  data?: any
  event?: string
  realm?: string
  quark?: Quark
}

type EventListener = (data: EventData) => void

type PipeFn<T> = (value: T) => T | undefined

interface QuarkOptions<T> {
  value?: T
  realm?: string
  id?: string
  dedup?: boolean
  stateless?: boolean
  pipe?: PipeFn<T>
}

interface Quark<T> {
  // Callable
  (): T
  (value: T): T

  // Subscriptions
  up(listener: Listener<T>): this
  down(listener: Listener<T>): this
  silent(fn: () => void): this

  // Events
  on(event: string, listener: EventListener): this
  off(event: string, listener: EventListener): this
  once(event: string, listener: EventListener): this
  emit(event: string, data?: any): this

  // Configuration
  pipe(fn: PipeFn<T>): this
  dedup(enable?: boolean): this
  stateless(enable?: boolean): this

  // Cleanup
  clear(): this
  decay(): void

  // Properties
  uid: number
  value: T
  id?: string
  readonly _flags: number
  readonly _realm?: string
}

interface QuConstructor {
  <T>(options?: QuarkOptions<T>): Quark<T>
}

interface QvConstructor {
  <T>(value?: T, options?: Omit<QuarkOptions<T>, 'value'>): Quark<T>
}

export const Qu: QuConstructor
export const Qv: QvConstructor
```

---

## Примеры использования

### Простой счётчик
```typescript
const counter = Qu({value: 0})

counter.up((value) => {
  console.log('Count:', value)
})

counter(counter() + 1)  // Count: 1
```

### С дедупликацией
```typescript
const name = Qu({value: 'John', dedup: true})

name.up((value) => {
  console.log('Name changed:', value)
})

name('John')  // Listener не вызовется (то же значение)
name('Jane')  // Name changed: Jane
```

### С валидацией
```typescript
const age = Qu({value: 0})

age.pipe((value) => {
  if (value < 0 || value > 150) return undefined
  return Math.round(value)
})

age(25.7)    // → 26
age(-5)      // → отклонено
age(200)     // → отклонено
```

### Cross-realm коммуникация
```typescript
const counter = Qu({value: 0, realm: 'counters', id: 'main'})
const logger = Qu({realm: 'logs'})

// Logger подписывается на события counters
logger.on('counters:increment', (data) => {
  console.log('Counter incremented:', data.id)
})

// Counter отправляет событие
counter.emit('increment', {delta: 1})
```

### Stateless event bus
```typescript
const bus = Qu({stateless: true})

bus.up((value) => {
  console.log('Event:', value)
})

bus('event1')  // Event: event1
bus('event2')  // Event: event2
console.log(bus())  // undefined (значение не сохраняется)
```

---

## Сравнение с nucleus

| Особенность | nucleus | quark |
|-------------|---------|-------|
| Размер | ~4KB | ~2KB (цель) |
| API методов | 20+ | 12 core |
| Proxy | Да | Нет (Function+Prototype) |
| Event bus | Нет | Да (встроен) |
| Realms | Нет | Да |
| Плагины | Нет | Да |
| Производительность | Baseline | 7.6x быстрее |
| Filters | Да (core) | Нет (plugin) |
| Computed | Да (core) | Нет (plugin) |

---

## Статус реализации

- [ ] Core создание (createQu)
- [ ] Прототип методы (up/down/silent)
- [ ] События (on/off/once/emit)
- [ ] Quantum bus
- [ ] Realms
- [ ] pipe функциональность
- [ ] dedup функциональность
- [ ] stateless функциональность
- [ ] Bit flags оптимизация
- [ ] Fast paths в setValue
- [ ] TypeScript типы
- [ ] Тесты
- [ ] Система плагинов
