# Плагин `std` (Standard Helpers)

Плагин `std` добавляет удобные методы для работы с массивами, объектами и проверки состояния.

## Подключение
```typescript
import '@alaq/nucl/presets/std';
// Или вручную
defineKind('std', stdPlugin);
```

## Геттеры (Свойства)

- **`.isEmpty`** — `true`, если значение пустое.
  ```typescript
  const n = Nv([], { kind: 'std' });
  console.log(n.isEmpty); // true
  n([1]);
  console.log(n.isEmpty); // false
  ```
- **`.size`** — Длина массива.
  ```typescript
  const n = Nv([10, 20], { kind: 'std' });
  console.log(n.size); // 2
  ```
- **`.keys`** / **`.values`** — Ключи и значения объекта.
  ```typescript
  const user = Nv({ id: 1, name: 'Gleb' }, { kind: 'std' });
  console.log(user.keys);   // ['id', 'name']
  console.log(user.values); // [1, 'Gleb']
  ```

---

## Универсальные методы

### `.upSome(listener)`
Подписка, которая игнорирует пустые значения.
```typescript
const n = Nv(null, { kind: 'std' });
n.upSome(v => console.log('Data:', v));

n(null);      // Ничего не произойдет
n(undefined); // Ничего не произойдет
n('Hello');   // Лог: Data: Hello
```

### `.injectTo(obj)` / `.injectAs(key, obj)`
Связывает нуклон со свойством внешнего объекта.
```typescript
const config = { theme: 'dark' };
const theme = Nv('light', { kind: 'std' });

theme.injectAs('theme', config);

console.log(config.theme); // 'light'
config.theme = 'dark';     // Обновит нуклон theme
console.log(theme.value);  // 'dark'
```

---

## Методы для массивов
*Все методы создают новую копию массива.*

```typescript
const list = Nv([1, 2], { kind: 'std' });

list.push(3, 4);      // value теперь [1, 2, 3, 4]
const last = list.pop(); // value теперь [1, 2, 3], last = 4

const item = list.find(v => v > 1); // 2
const second = list.at(1);          // 2
```

---

## Методы для объектов

```typescript
const settings = Nv({ volume: 50, bright: 10 }, { kind: 'std' });

settings.set('volume', 60); // value теперь { volume: 60, bright: 10 }
const v = settings.get('volume'); // 60

// Выборка полей
const subset = settings.pick('volume'); // { volume: 60 }
```