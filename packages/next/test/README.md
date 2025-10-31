# Тесты next

Тесты для пакета `@alaq/next` проверяют работу ComputedPlugin и его интеграцию с Vue.

## Структура тестов

### from.test.ts
Основные тесты для метода `.from()` - computed nucleus:
- ✅ Режимы: `some`, `weak`, `strong`
- ✅ Базовая реактивность
- ✅ Цепочки вычислений
- ✅ Cleanup при decay
- ✅ Трансформации данных
- ✅ Обработка ошибок

### from-coverage.test.ts
Расширенное покрытие edge cases:
- ✅ Повторные вызовы `.from()`
- ✅ Async функции вычисления
- ✅ Источники-промисы
- ✅ Режимы weak/finite
- ✅ Stateless источники
- ✅ Смешанные sync/async источники

### vue-integration.test.ts 🆕
Интеграция ComputedPlugin с Vue `watch` и `watchEffect`:

#### Отслеживание изменений computed nucleus
```typescript
const sum = Nucleus().from(a, b).weak((x, y) => x + y)
const sumRef = sum.toRef()

watch(sumRef, (newValue) => {
  console.log('Sum changed:', newValue)
})
```

#### Async computed
```typescript
const doubled = Nucleus()
  .from(input)
  .weak(async (x) => {
    await fetchData()
    return x * 2
  })

watch(doubled.toRef(), ...)
```

#### Цепочки computed с Vue refs
```typescript
const input = Nucleus(2)
const doubled = Nucleus().from(input).weak(x => x * 2)
const tripled = Nucleus().from(doubled).weak(x => x * 3)

const inputRef = input.toReactive()
const tripledRef = tripled.toRef()

watch(tripledRef, ...) // реагирует на изменения inputRef
```

#### Синхронизация с внешними refs
```typescript
const price = Nucleus(100)
const total = Nucleus().from(price, quantity).weak((p, q) => p * q)

const externalPrice = ref(150)
price.syncWith(externalPrice)

watch(total.toRef(), ...) // отслеживает изменения через externalPrice
```

#### Cleanup и decay
```typescript
const computed = Nucleus().from(source).weak(...)

computed.decay()
// watch больше не вызывается, но ref сохраняет последнее значение
```

## Результаты тестов

```
from.test.ts              - 94 теста ✅
from-coverage.test.ts     - 10 тестов ✅
vue-integration.test.ts   - 48 тестов ✅
──────────────────────────────────────
ИТОГО:                     152 теста ✅
```

## Покрытие кода

- **next/computed.ts**: 96% coverage
- **nucleus/src**: 69% coverage (основные пути покрыты)
- **vue/nucleusPlugin.ts**: 89% coverage

## Как запустить

```bash
# Все тесты next
npx tap packages/next/test/*.test.ts

# Только Vue интеграция
npx tap packages/next/test/vue-integration.test.ts

# С покрытием
npm start cover
```

## Важные паттерны из тестов

### ✅ Правильно: watch создается ПОСЛЕ toRef/toReactive
```typescript
const computed = Nucleus().from(source).weak(...)
const ref = computed.toRef()

watch(ref, ...) // ✅
```

### ✅ Правильно: immediate mode для начальных значений
```typescript
watch(computedRef, ..., { immediate: true })
```

### ✅ Правильно: cleanup watchers
```typescript
const stopWatch = watch(ref, ...)
// ...
stopWatch() // останавливаем
```

### ✅ Правильно: deep watch для объектов
```typescript
watch(objectRef, ..., { deep: true })
```
