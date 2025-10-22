# @alaq/vite

> Vite плагин для автоматической генерации кода Alak моделей

Плагин для Vite, который автоматически генерирует код для моделей и bitmask'ов в режиме разработки.

## Установка

```bash
npm install @alaq/vite -D
```

## Использование

### Базовая настройка

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import { Alak } from '@alaq/vite'

export default defineConfig({
  plugins: [
    Alak({
      models: 'src/models',    // Папка с моделями
      bitmasks: [],             // Массив путей к bitmask файлам
      output: 'src/-'           // Папка для генерируемого кода
    })
  ]
})
```

### Структура проекта

```
src/
├── models/           # Ваши модели
│   ├── UserModel.ts
│   └── TodoModel.ts
├── -/                # Автогенерируемый код (в .gitignore)
│   └── index.ts      # Экспорты всех моделей
└── main.ts
```

## Возможности

### Автоматическая генерация индексов

Плагин сканирует папку `models/` и создает файл индекса со всеми экспортами:

```typescript
// src/-/index.ts (автогенерируется)
export { UserModel } from '../models/UserModel'
export { TodoModel } from '../models/TodoModel'
```

### Hot Module Replacement

При изменении файлов моделей плагин автоматически обновляет генерируемый код и перезагружает страницу.

## Опции

| Опция | Тип | По умолчанию | Описание |
|-------|-----|--------------|----------|
| `models` | `string` | `'src/models'` | Путь к папке с моделями |
| `bitmasks` | `string[]` | `[]` | Массив glob-паттернов для bitmask файлов |
| `output` | `string` | `'src/-'` | Папка для генерируемых файлов |

## Пример конфигурации

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { Alak } from '@alaq/vite'

export default defineConfig({
  plugins: [
    vue(),
    Alak({
      models: 'src/domain/models',
      output: 'src/domain/generated'
    })
  ]
})
```

## Рекомендации

1. Добавьте папку `output` в `.gitignore`:
   ```gitignore
   src/-/
   ```

2. Используйте генерируемый индекс для импортов:
   ```typescript
   // ✅ Хорошо
   import { UserModel, TodoModel } from '@/domain/generated'

   // ❌ Избегайте прямых импортов
   import { UserModel } from '@/domain/models/UserModel'
   ```

## Совместимость

- Vite 3.0+
- TypeScript

## Лицензия

TVR
