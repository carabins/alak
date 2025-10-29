# Performance Optimizations TODO

Идеи для улучшения производительности Quark после завершения работы над API.

---

## 🔥 Критические (High Priority)

### 1. Monomorphic Shapes
**Проблема:** Разная структура объектов кварков замедляет V8 inline caching

**Решение:** Всегда инициализировать ВСЕ поля (даже null/undefined)
```typescript
quark.uid = ++uidCounter
quark._flags = 0
quark._realm = options?.realm || null
quark._realmPrefix = null
quark.listeners = null
quark._events = null
quark._eventCounts = null
quark._guardFn = null
quark._dedupFn = null
quark._wildcardListeners = null
// все поля одинаковы для всех кварков
```

**Ожидаемый эффект:** +20-30%
**Статус:** ⏳ TODO

---

### 2. Inline Listeners Array
**Проблема:** Set медленнее массива для малого кол-ва listeners (<10)

**Решение:** Использовать массив вместо Set
```typescript
// Было
quark.listeners = new Set()

// Стало
quark.listeners = null
quark.listenerCount = 0

// При добавлении
if (!quark.listeners) quark.listeners = []
quark.listeners[quark.listenerCount++] = fn

// При notify - прямой цикл
for (let i = 0; i < quark.listenerCount; i++) {
  quark.listeners[i](value, quark, meta)
}
```

**Ожидаемый эффект:** +15-25%
**Статус:** ⏳ TODO

---

### 3. Pre-allocated Event Data
**Проблема:** Создание объекта {id, value, data} при каждом emit

**Решение:** Переиспользовать один объект
```typescript
const eventDataPool = {
  id: null,
  value: null,
  data: null
}

function emit(event, data) {
  eventDataPool.id = this.id
  eventDataPool.value = this.value
  eventDataPool.data = data

  listeners.forEach(fn => fn(eventDataPool))

  // Cleanup
  eventDataPool.data = null
}
```

**Ожидаемый эффект:** -100% allocations в emit
**Статус:** ⏳ TODO

---

### 4. Object Pooling
**Проблема:** Создание нового кварка = allocations

**Решение:** Переиспользовать decay'нутые кварки
```typescript
const pool: any[] = []

function createQu(value, options) {
  const quark = pool.length > 0 ? pool.pop() : createNewQuark()
  resetQuark(quark)
  initQuark(quark, value, options)
  return quark
}

quark.decay = function() {
  cleanup(this)
  if (pool.length < 100) pool.push(this)
}
```

**Ожидаемый эффект:** -50% allocations, +10-20% создание
**Статус:** ⏳ TODO

---

### 5. Remove setPrototypeOf
**Проблема:** Object.setPrototypeOf медленнее прямого копирования

**Решение A:** Копировать методы
```typescript
Object.assign(quark, quarkProto)
```

**Решение B:** Object.create с template
```typescript
const quark = Object.create(quarkProtoTemplate)
```

**Ожидаемый эффект:** +5-10% создание
**Статус:** ⏳ TODO

---

## 🟡 Средние (Medium Priority)

### 6. Typed Arrays для Counters
**Проблема:** Object для _eventCounts медленнее typed arrays

**Решение:**
```typescript
const eventIds = new Map() // event name -> id
quark._eventCounts = new Uint16Array(256) // max 256 событий
```

**Ожидаемый эффект:** +5-10% операции с событиями
**Статус:** ⏳ TODO

---

### 7. Lazy String Concatenation
**Проблема:** `_realmPrefix = realm + ':'` создаёт строку заранее

**Решение:** Вычислять на лету
```typescript
// Вместо хранения _realmPrefix
const realmEvent = quark._realm + ':' + event
// V8 оптимизирует конкатенацию
```

**Ожидаемый эффект:** Экономия памяти
**Статус:** ⏳ TODO

---

### 8. Conditional Meta Passing
**Проблема:** Передача meta даже если undefined

**Решение:**
```typescript
if (meta !== undefined) {
  listeners.forEach(fn => fn(value, quark, meta))
} else {
  listeners.forEach(fn => fn(value, quark))
}
```

**Ожидаемый эффект:** +3-5% если meta не используется
**Статус:** ⏳ TODO

---

### 9. Remove Closures
**Проблема:** once() создаёт closure при каждом вызове

**Решение:** Переиспользовать wrapper функцию
```typescript
function onceWrapper(data) {
  const ctx = this._onceCtx
  ctx.self.off(ctx.event, onceWrapper)
  ctx.listener(data)
}

once(event, listener) {
  this._onceCtx = {self: this, event, listener}
  this.on(event, onceWrapper)
}
```

**Ожидаемый эффект:** -1 allocation per once
**Статус:** ⏳ TODO

---

## 🟢 Низкие (Low Priority)

### 10. WeakMap для Metadata
**Проблема:** Добавление свойств в quark увеличивает размер объекта

**Решение:**
```typescript
const guardFns = new WeakMap()
guardFns.set(quark, fn)

// Проверка
const guardFn = guardFns.get(quark)
if (guardFn && !guardFn(value)) return
```

**Ожидаемый эффект:** Меньше свойств = быстрее GC
⚠️ Может быть медленнее для hot path
**Статус:** ⏳ TODO (измерить!)

---

### 11. JIT Warm-up
**Проблема:** Первые вызовы медленнее из-за холодного JIT

**Решение:** Прогрев перед бенчмарком
```typescript
for (let i = 0; i < 10000; i++) {
  const q = Qu(i)
  q.up(() => {})
  q(i * 2)
  q.emit('test')
}
```

**Ожидаемый эффект:** Корректные измерения
**Статус:** ⏳ TODO

---

## 📊 Ожидаемый совокупный эффект

При реализации критических оптимизаций:
- **Создание:** +30-40%
- **Get/Set:** +25-35%
- **Events:** +20-30%
- **Memory:** -40-50% allocations

---

## 🔬 План тестирования

1. Создать baseline бенчмарк текущей версии
2. Применять оптимизации по одной
3. Измерять до/после для каждой
4. Проверять что ничего не сломалось
5. Сравнивать с бенчмарками nucleus

---

## 📝 Checklist

- [ ] Monomorphic shapes
- [ ] Inline listeners array
- [ ] Pre-allocated event data
- [ ] Object pooling
- [ ] Remove setPrototypeOf
- [ ] Typed arrays для counters
- [ ] Lazy string concat
- [ ] Conditional meta passing
- [ ] Remove closures
- [ ] WeakMap metadata (измерить!)
- [ ] JIT warm-up для тестов

---

## 🎯 Текущий baseline

```
✅ ESSENCE 1: Performance 3ms for 100k ops (без listeners)
✅ ESSENCE 2: Quantum Bus works correctly
```

После оптимизаций цель: **<2ms для 100k ops**
