# @alaq/fx

> Reactive Effect System for Quark/Nucl ecosystem

**fx** — легковесная (zero-dep) библиотека для управления побочными эффектами, таймерами и асинхронностью в реактивных системах.

## Концепция

Библиотека предоставляет Fluent API (цепочку вызовов) для превращения потока изменений данных в конкретные действия (сайд-эффекты).

Она **агностична** к источнику данных. Ей не важно, что вы используете — `@alaq/quark`, `@alaq/nucl` или кастомный Event Emitter, главное — соблюдение контракта `Subscribable`.

## API

### Контракт Источника (Interface)

```typescript
interface Subscribable<T> {
  up(listener: (val: T) => void): any;   // Подписка
  down(listener: (val: T) => void): void; // Отписка
  value: T;                               // Текущее значение
}
```

### Основной поток

#### `fx(source)`
Создает обертку над источником для начала цепочки.

#### `.up(handler)`
Финальный метод. Подписывается на цепочку и выполняет `handler`.
Возвращает функцию отписки (`Unsubscribe`).

```typescript
const dispose = fx(source).up(val => console.log(val));
dispose(); // Полная остановка эффекта
```

### Операторы

#### `.map(fn)`
Трансформация данных.
```typescript
fx(user).map(u => u.name).up(updateTitle)
```

#### `.filter(fn)` / `.when(fn)`
Фильтрация событий.
```typescript
fx(count).filter(x => x > 5).up(alert)
```

#### `.with(otherSource)`
Семплирование (Sampling). Добавляет значение другого источника **без подписки** на него.
```typescript
fx(click).with(formData).up(([_, data]) => send(data))
```

#### `.skip(n)` / `.take(n)`
Пропуск первых N событий или завершение после N событий.
```typescript
fx(event).take(1).up(fn) // Аналог .once()
```

### Тайминги

#### `.debounce(ms)`
Сбрасывает таймер при каждом новом событии. Пропускает событие только если после него была "тишина" в течение `ms`.
*Use case:* Поиск, ресайз окна.

#### `.delay(ms)`
Просто сдвигает выполнение события во времени. Если источник обновился во время ожидания — предыдущий таймер отменяется (cleanup).
*Use case:* Задержка показа лоадера.

### Асинхронность и Ошибки

#### `.async(fn)`
Выполняет асинхронную функцию.
*   Предоставляет `AbortSignal` первым аргументом (или вторым, если есть данные).
*   Автоматически отменяет предыдущий вызов (вызывает `abort`), если пришло новое событие.
*   Поведение по умолчанию: **Switch** (последний побеждает).

```typescript
fx(id).async(async (val, signal) => {
  await fetch(url, { signal });
})
```

#### `.catch(fn)`
Перехватывает ошибки, возникшие в `.async` или `.map`.
Если `.catch` не определен, ошибки могут всплывать в глобальный конфиг (TODO).

```typescript
fx(id)
  .async(apiCall)
  .catch(err => console.error(err))
  .up(render)
```

## Пример

```typescript
import { fx } from '@alaq/fx';

// Search Typeahead
fx(searchQuery)
  .map(q => q.trim())
  .filter(q => q.length >= 3)
  .debounce(300)
  .async((q, signal) => api.search(q, { signal }))
  .catch(err => toast.error(err))
  .up(results => updateList(results));
```
