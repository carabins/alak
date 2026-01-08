# Плагины и Виды (Kinds)

Нуклоны (`Nu`, `Nv`) расширяются с помощью системы плагинов. Плагины могут добавлять новые методы, свойства и перехватывать жизненный цикл изменения значения.

## 1. Подключение готовых плагинов

### Через пресеты (Рекомендуется)
Пресеты — это готовые конфигурации, которые регистрируют плагины под определенным именем (Kind).

**Комбинация видов**: Вы можете комбинировать несколько видов, перечисляя их через пробел. Нуклон объединит все методы этих плагинов.

```typescript
import { Nv } from '@alaq/nucl';
import '@alaq/nucl/presets/std';
import '@alaq/nucl/presets/deep';

// Объединение стандартных хелперов и глубокой реактивности
const list = Nv([1, 2], { kind: 'std deep' });

list.push(3);           // Метод из 'std'
list.value[0] = 10;     // Реактивность из 'deep'
```

### Через `defineKind` (Ручная регистрация)
Вы можете зарегистрировать плагин под своим именем. Чтобы TypeScript узнал о новом виде, необходимо расширить интерфейс `NuclearKindRegistry`.

```typescript
import { Nv, defineKind } from '@alaq/nucl';
import { stdPlugin } from '@alaq/nucl/std';

// 1. Регистрация логики
defineKind('my-list', stdPlugin);

// 2. Добавление типизации (в .d.ts файле или в начале проекта)
declare module '@alaq/nucl' {
  export interface NuclearKindRegistry {
    'my-list': any; // Ключ — это имя вида
  }
}

const n = Nv([], { kind: 'my-list' });
```

---

## 2. Создание своего плагина

Плагин — это объект, который может содержать хуки жизненного цикла и новые методы.

### Структура плагина
```typescript
import { INucleonPlugin } from '@alaq/nucl';

const myLogPlugin: INucleonPlugin = {
  name: 'logger',
  
  // Вызывается при создании каждого нуклона
  onCreate(n) {
    console.log('Нуклон создан с id:', n.id);
  },

  // Вызывается перед изменением значения
  onBeforeChange(n, newValue) {
    console.log(`Меняем значение на: ${newValue}`);
  },

  // Добавление методов на экземпляр
  methods: {
    logValue() {
      // 'this' указывает на экземпляр нуклона
      console.log('Текущее значение:', this.value);
    }
  }
};
```

### Подключение локального плагина
Если плагин нужен только для одного экземпляра, его можно передать в опции `plugins`:

```typescript
const n = Nv(10, { plugins: [myLogPlugin] });
(n as any).logValue();
```
