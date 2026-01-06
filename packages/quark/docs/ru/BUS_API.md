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

### `.on(event, listener)`
Подписывается на событие в этом Realm (Мире).
- **event** *(string)*: Имя события. Поддерживает wildcards.
- **listener**: `(payload) => void`

**Паттерны событий:**
- `'EVENT_NAME'`: Конкретное событие.
- `'*'`: **Все** события в этом Realm (Мире).
- `'realm:event'`: Событие из **другого** Realm (Мира) (Cross-Realm).
- `'*:*'`: Глобальный wildcard.

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