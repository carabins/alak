# Quark

Самый быстрый реактивный контейнер для JavaScript. Просто переменная, которая умеет уведомлять об изменениях.

## Зачем?

Обычная переменная:
```javascript
let count = 0
count = 1  // Никто не узнает что изменилось
```

Quark:
```javascript
import { Qv } from '@alaq/quark'

const count = Qv(0)

count.up((value) => {
  console.log('Счётчик изменился:', value)
})

count(1)  // → Счётчик изменился: 1
```

## Установка

```bash
npm install @alaq/quark
# или
bun add @alaq/quark
```

## Два способа создать

```javascript
import { Qu, Qv } from '@alaq/quark'

// Способ 1: Qu с опциями
const counter = Qu({ value: 0 })

// Способ 2: Qv (короче)
const counter = Qv(0)
```

## Основное использование

### Чтение и запись

```javascript
const count = Qv(0)

console.log(count.value)  // Читать → 0

count(5)                  // Писать → 5
count(count.value + 1)    // Увеличить → 6
```

### Подписка на изменения

```javascript
const name = Qv('Вася')

name.up((value) => {
  console.log('Привет,', value)
})

name('Петя')  // → Привет, Петя
```

### Отписка

```javascript
const listener = (value) => console.log(value)

name.up(listener)    // Подписаться
name.down(listener)  // Отписаться
```

## Продвинутые возможности

### Валидация и трансформация

```javascript
const age = Qv(0)

age.pipe((value) => {
  if (value < 0) return undefined  // Отклонить
  return Math.round(value)         // Округлить
})

age(25.7)  // → 26
age(-5)    // → отклонено, осталось 26
```

### Дедупликация

Не уведомлять, если значение не изменилось:

```javascript
const status = Qv('loading', { dedup: true })

status.up((value) => console.log('Статус:', value))

status('loading')  // Ничего не произойдёт (то же значение)
status('ready')    // → Статус: ready
```

### События

Встроенная шина событий:

```javascript
const user = Qv({ id: 1, name: 'Вася' })

user.on('login', (data) => {
  console.log('Пользователь вошёл:', data)
})

user.emit('login', { time: Date.now() })
```

### Кросс-модульная коммуникация (realms)

```javascript
// Модуль A
const counterA = Qv(0, { realm: 'counters', id: 'main' })

counterA.emit('increment')

// Модуль B (в другом файле)
const loggerB = Qv(null, { realm: 'logger' })

loggerB.on('counters:increment', (data) => {
  console.log('Счётчик в другом модуле увеличился!')
})
```

## Производительность

Очень быстрый. Бенчмарки в вашем браузере:

```bash
cd packages/quark
bun run bench:browser
```

Результаты (Bun):
- **425,000 ops/ms** - чтение
- **268,000 ops/ms** - запись
- **10,800 ops/ms** - среднее по всем операциям

## API

- `count.value` - прочитать значение
- `count(newValue)` - записать значение
- `count.up(listener)` - подписаться на изменения
- `count.down(listener)` - отписаться
- `count.on(event, listener)` - подписаться на событие
- `count.emit(event, data)` - отправить событие
- `count.pipe(fn)` - валидация/трансформация
- `count.dedup(true)` - включить дедупликацию
- `count.silent(value)` - изменить без уведомлений

Полный API: [API.md](./API.md)

## TypeScript

Полная поддержка типов из коробки:

```typescript
const count = Qv<number>(0)
const user = Qv<{ name: string; age: number }>({ name: 'Вася', age: 25 })

count.up((value) => {
  // value: number
})
```

## Зачем нужен Quark?

1. **Простой** - всего 2 концепции: чтение и запись
2. **Быстрый** - одна из самых быстрых реактивных систем
3. **Маленький** - ~10KB в бандле
4. **Гибкий** - events, realms, pipe, dedup, stateless
5. **Безопасный** - TypeScript из коробки

## Лицензия

MIT
