# Плагины Atom

Плагины позволяют расширять поведение моделей Atom: добавлять автоматические вычисления, внедрять соглашения по именованию или синхронизировать данные с внешними источниками.

## 1. Подключение плагинов

### Использование видов (Kinds)
Как и в Nucl, вы можете регистрировать именованные наборы плагинов (Kinds) для моделей. Это позволяет быстро настраивать типовое поведение (например, для моделей данных, UI или сетевых запросов) с полной поддержкой автокомплита.

```typescript
import { Atom, defineAtomKind } from '@alaq/atom';
import { ComputedPlugin, ConventionsPlugin } from '@alaq/atom/plugins';

// 1. Регистрация вида (обычно в bootstrap)
defineAtomKind('std', [ComputedPlugin, ConventionsPlugin]);

// 2. Добавление типизации
declare module '@alaq/atom' {
  export interface AtomicKindRegistry {
    'std': any;
  }
}

// 3. Использование
const store = Atom(MyModel, { kind: 'std' });
```

### Локальное подключение
Если плагин нужен только для конкретной модели, передайте его в `options.plugins`. При этом поле `kind` будет игнорироваться.

```typescript
const store = Atom(MyModel, {
  plugins: [LogPlugin]
});
```

---

## 2. Создание своего плагина

Плагин — это объект с хуками жизненного цикла модели.

### Интерфейс плагина
```typescript
import { AtomPlugin } from '@alaq/atom';

const MyCustomPlugin: AtomPlugin = {
  name: 'custom-extender',

  // Вызывается перед анализом модели
  onSetup(model, options) {
    console.log('Настройка модели:', options.name);
  },

  // Вызывается для каждого найденного свойства (до создания нуклона)
  onProp({ key, orbit, atom }) {
    if (key.startsWith('meta_')) {
      orbit.kind = 'std'; // Можно изменить тип нуклона на лету
    }
  },

  // Вызывается для каждого метода класса
  onMethod({ key, fn, atom }) {
    // Можно обернуть метод (например, для логирования)
    return (...args) => {
      console.log(`Вызов метода ${key}`);
      return fn(...args);
    };
  },

  // Вызывается после полной инициализации прокси
  onInit(atom) {
    console.log('Атом готов к работе');
  },

  // Вызывается при уничтожении атома
  onDecay(atom) {
    console.log('Атом уничтожен');
  }
};
```
