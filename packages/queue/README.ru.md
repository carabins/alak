# @alaq/queue

> Высокопроизводительный реактивный планировщик задач (Job Scheduler) для экосистемы Alak.

## Концепция

**queue** — это полноценный Job Scheduler с нативной интеграцией в Alak. 
Ключевое отличие — использование легковесных примитивов **Quark** для всех состояний. Это обеспечивает минимальный оверхед и высокую производительность даже при большом потоке событий.

### Особенности

- **V8-оптимизирован** — минимальное потребление памяти, быстрые операции.
- **Reactive-first** — все состояния (размер, простой, пауза) являются `Quark<T>`.
- **Full-featured** — конкурентность (concurrency), приоритеты, повторы (retry), отложенный запуск (scheduling), зависимости.
- **Zero dependencies** — только peer dependency на `@alaq/quark`.

---

## Установка

```bash
npm install @alaq/queue @alaq/quark
```

## Быстрый старт

```typescript
import { createQueue } from '@alaq/queue'

// Создаем очередь
const queue = createQueue({
  concurrency: 3, // 3 задачи параллельно
  processor: async (job) => {
    // Ваша логика обработки
    const result = await fetch(job.data.url)
    return result.json()
  }
})

// Подписываемся на реактивные состояния (Quark)
queue.pending.up(count => console.log('В ожидании:', count))
queue.active.up(count => console.log('В работе:', count))
queue.completed.up(count => console.log('Готово:', count))

// Добавление задач
queue.add({ url: '/api/ad/1' })
queue.add({ url: '/api/ad/2' }, { priority: 10 }) // Высокий приоритет

// Управление
queue.pause()
```

---

## API Reference

### `createQueue<T, R>(options)`

Создаёт новую очередь.

```typescript
interface QueueOptions<T, R> {
  // Обработчик задач (обязательный)
  processor: (job: Job<T>) => Promise<R> | R
  
  // Максимум параллельных задач (по умолчанию: 1)
  concurrency?: number
  
  // Автозапуск обработки при добавлении (по умолчанию: true)
  autoStart?: boolean
  
  // ID очереди (полезно для отладки и событий)
  id?: string
}

const queue = createQueue<AdConfig, AdResult>({
  id: 'ads-loader',
  concurrency: 3,
  processor: async (job) => await loadAd(job.data)
})
```

---

## Управление задачами (Job Management)

### `.add(data, options?)`

Добавляет задачу в очередь.

```typescript
interface JobOptions {
  // Приоритет (выше число = раньше выполнится). Default: 0
  priority?: number
  
  // Задержка перед запуском (ms)
  delay?: number
  
  // Таймаут выполнения (ms)
  timeout?: number
  
  // Количество повторов при ошибке
  retries?: number
  
  // Стратегия backoff для retry
  backoff?: { 
    type: 'fixed' | 'exponential', 
    delay: number 
  }
  
  // ID задачи (генерируется автоматически, если не указан)
  id?: string
  
  // Зависимости - ждать завершения других задач по ID
  dependsOn?: string | string[]
}

// Пример
queue.add(
  { url: '/api/critical' },
  { 
    priority: 100,
    retries: 3,
    backoff: { type: 'exponential', delay: 1000 }
  }
)
```

### `.addMany(items)`

Массовое добавление задач (эффективнее, чем вызывать add в цикле).

```typescript
queue.addMany([
  { data: { url: '/api/1' } },
  { data: { url: '/api/2' }, options: { priority: 10 } }
])
```

### Методы управления

- **`.remove(jobId)`** — Удаляет задачу из ожидания (`pending`).
- **`.cancel(jobId)`** — Отменяет активную задачу (вызывает abort signal).
- **`.clear(mode?)`** — Очистка очереди.
  - `queue.clear()` — только ожидающие.
  - `queue.clear('all')` — ожидающие + отмена активных.

---

## Управление очередью

### `.pause()` / `.resume()`

Остановка и возобновление обработки очереди. Активные задачи завершатся, новые не начнутся.

```typescript
queue.pause()
// ...
queue.resume()
```

### `.drain()`

Возвращает `Promise`, который резолвится, когда очередь полностью пуста (нет ожидающих и активных задач).

```typescript
await queue.drain()
console.log('Все задачи выполнены')
```

### `.decay()`

Полное уничтожение экземпляра очереди. Очищает подписки, таймеры и внутренние структуры.

---

## Реактивное состояние (Quark)

Все свойства состояния являются инстансами `Quark`. На них можно подписаться через `.up()`.

### Счетчики (number)

```typescript
queue.size.up(n => {})      // Всего (pending + active)
queue.pending.up(n => {})   // В ожидании
queue.active.up(n => {})    // В обработке
```

### Флаги (boolean)

```typescript
queue.isPaused.up(v => {})   // Очередь на паузе?
queue.isIdle.up(v => {})     // Очередь простаивает (нет активных)?
queue.isEmpty.up(v => {})    // Очередь пуста (нет pending и active)?
```

---

## Объект задачи (Job)

```typescript
interface Job<T> {
  id: string
  data: T
  
  // Состояние (Quark)
  // 'pending' | 'active' | 'completed' | 'failed' | 'cancelled'
  status: Quark<JobStatus>
  
  // Прогресс 0-100 (Quark)
  progress: Quark<number>
  
  // Результат выполнения
  result: Promise<R>
  
  // Ошибка (если failed)
  error: Quark<Error | null>
  
  attempts: number
}
```

Пример использования внутри процессора:

```typescript
queue.processor = async (job) => {
  job.progress.set(10) // Обновляем прогресс (реактивно)
  
  const data = await heavyTask()
  
  job.progress.set(100)
  return data
}
```

---

## События (Events)

Очередь является эмиттером событий.

```typescript
queue.on('job:added', (job) => {})
queue.on('job:started', (job) => {})
queue.on('job:completed', (job, result) => {})
queue.on('job:failed', (job, error) => {})
queue.on('queue:drained', () => {})
```

---

## Сохранение состояния (Persistence)

Опциональная возможность сохранять задачи между перезагрузками страницы. В текущей версии поддерживается простой адаптер для `localStorage`.

> **Важно:** Данные задач (`job.data`) должны быть сериализуемы в JSON.

```typescript
import { createQueue } from '@alaq/queue'
import { localStorageAdapter } from '@alaq/queue/persistence'

const queue = createQueue({
  processor: myProcessor,
  // Автоматически сохраняет состояние в localStorage по ключу 'my-queue-v1'
  persistence: localStorageAdapter('my-queue-v1')
})

// При перезагрузке страницы, незавершенные задачи восстановятся
```

---

## Интеграция с fx

Поскольку очередь построена на `Quark`, она нативно работает с `@alaq/fx`.

```typescript
import { fx } from '@alaq/fx'
import { quark } from '@alaq/quark'

// Пример: Пауза очереди при потере сети
const isOnline = quark(navigator.onLine)

window.addEventListener('online', () => isOnline.set(true))
window.addEventListener('offline', () => isOnline.set(false))

fx(isOnline).run((online) => {
  if (online) queue.resume()
  else queue.pause()
})

// Пример: Показать спиннер, если есть активные задачи
fx(queue.active)
  .map(count => count > 0)
  .run(isVisible => {
    spinner.style.display = isVisible ? 'block' : 'none'
  })
```

---

## Сравнение

| Фича | @alaq/queue | p-queue | bull |
|---|---|---|---|
| Среда | Browser / Node | Browser / Node | Node (Redis) |
| Реактивность | **Native (Quark)** | Events | Events |
| Приоритеты | Да | Да | Да |
| Зависимости задач | Да | Нет | Да |
| Размер бандла | ~4kb | ~3kb | N/A |
