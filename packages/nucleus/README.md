# @alaq/nucleus

> Реактивный контейнер-функция для управления потоками данных

Nucleus (нуклон) — это функция-контейнер для реактивной доставки данных в функции-получатели. Это базовый примитив библиотеки Alak, аналог Observable/Signal.

## Установка

```bash
npm install @alaq/nucleus
```

## Основные концепции

- **Nucleus** — функция, которая хранит значение и уведомляет подписчиков об изменениях
- **Подписка** — добавление функций-получателей через `.up()`, `.next()`, `.once()`
- **Реактивность** — автоматическое обновление зависимых вычислений

## Примеры использования

### Пример 1: Базовое использование

```typescript
import { N } from '@alaq/nucleus'

// Создать nucleus с начальным значением
const count = N(0)

// Подписаться на изменения
count.up((value) => {
  console.log('Count changed:', value) // Count changed: 0
})

// Обновить значение
count(5) // Count changed: 5

// Получить текущее значение
console.log(count.value) // 5
```

### Пример 2: Вычисляемые значения

```typescript
import { N } from '@alaq/nucleus'

const price = N(100)
const quantity = N(2)

// Создать вычисляемый nucleus
const total = N()
  .from(price, quantity)
  .map(([p, q]) => p * q)

total.up((value) => {
  console.log('Total:', value)
})

price(150) // Total: 300
quantity(3) // Total: 450
```

### Пример 3: Асинхронные источники данных

```typescript
import { N } from '@alaq/nucleus'

const userId = N(1)
const userData = N()

// Асинхронный getter
userData.setGetter(async () => {
  const response = await fetch(`/api/users/${userId.value}`)
  return response.json()
}, true)

// Автоматически загружается при изменении userId
userId.up(() => {
  userData() // Триггерит загрузку
})

userData.up((user) => {
  console.log('User loaded:', user)
})

userData.onAwait((isLoading) => {
  console.log('Loading:', isLoading)
})
```

## Основные методы

| Метод | Описание |
|-------|----------|
| `N(value)` | Создать nucleus с начальным значением |
| `.up(fn)` | Подписаться на изменения, получить текущее значение |
| `.next(fn)` | Подписаться на следующее изменение |
| `.once(fn)` | Получить значение один раз |
| `.down(fn)` | Отписаться от изменений |
| `.from(...nuclei)` | Создать зависимость от других nucleus |
| `.setGetter(fn)` | Установить функцию-источник данных |
| `.setWrapper(fn)` | Обернуть все входящие значения |
| `.stateless()` | Не сохранять значение (только передавать) |
| `.finite()` | Передавать только уникальные значения |
| `.decay()` | Очистить память, отписать всех слушателей |

## API

Полная документация типов доступна в [`types/INucleus.d.ts`](./types/INucleus.d.ts)

## Лицензия

TVR
