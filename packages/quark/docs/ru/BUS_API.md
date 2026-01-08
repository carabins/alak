# Справочник API Quantum Bus

**Quantum Bus (Квантовая Шина)** — система распределения событий, связывающая Quarks (Кварки), Realms (Миры) и внешний мир.

## Импорт

```typescript
import { quantumBus, CHANGE, AWAKE } from '@alaq/quark'
```

## Константы

- **`CHANGE`**: `'CHANGE'` — Стандартное имя события изменения значения.
- **`AWAKE`**: `'AWAKE'` — Излучается при активации первого слушателя.

---

## `quantumBus` (Менеджер)

Глобальный синглтон, управляющий всеми Realms (Мирами).

### `.getRealm(name)`
Возвращает экземпляр `RealmBus` для указанного имени.

```typescript
const uiBus = quantumBus.getRealm('ui')
```

### `.emit(realm, event, data)`
Отправляет событие в конкретный Realm (Мир) из глобальной области видимости.

```typescript
quantumBus.emit('ui', 'CLICK', { x: 10, y: 10 })
```

---

## `RealmBus`

Представляет конкретный канал (Realm) на шине.

### `.onScope(scope, event, listener)`
Подписывается на события в конкретной области видимости (Scope) и всех её подобрастях.
- **scope** *(string)*: Имя области (например, `'user.1'`).
- **event** *(string)*: Имя события.

```typescript
// Слушает события от конкретного юзера и всех его свойств
bus.onScope('user.1', 'CHANGE', data => console.log(data))
```

### `.emitInScope(scope, event, data)`
Отправляет событие в указанную область с **всплытием** (bubbling).
Событие будет доставлено:
1. Подписчикам точного scope (`user.1.name`).
2. Подписчикам родительских scope (`user.1`, `user`).
3. Глобальным подписчикам (`on(event)`).

```typescript
// Это уведомляет:
// 1. onScope('user.1.name', ...)
// 2. onScope('user.1', ...)
// 3. onScope('user', ...)
// 4. on('CHANGE', ...)
bus.emitInScope('user.1.name', 'CHANGE', { val: 'Ivan' })
```

### `.offScope(scope, event, listener)`
Отписывает слушателя от конкретной области.

### `.on(event, listener)`
Подписывается на событие **глобально** (ловит события из любых областей).

```typescript
const bus = quantumBus.getRealm('app')
bus.on('LOGIN', data => console.log(data))
```

### `.off(event, listener)`
Отписывает слушателя.

### `.emit(event, data)`
Отправляет событие внутри этого Realm (Мира).

### `.clear()`
Удаляет всех слушателей из этого Realm (Мира).