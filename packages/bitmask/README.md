# @alaq/bitmask

> Работа с битовыми масками и флагами

Библиотека для эффективной работы с битовыми масками, флагами и комбинациями.

## Установка

```bash
npm install @alaq/bitmask
```

## Использование

```typescript
import BitInstance from '@alaq/bitmask'

// Пример работы с правами доступа
const permissions = new BitInstance()

const READ = 1    // 0001
const WRITE = 2   // 0010
const EXECUTE = 4 // 0100
const DELETE = 8  // 1000

// Установить флаги
permissions.set(READ | WRITE)

// Проверить наличие флага
if (permissions.has(READ)) {
  console.log('Has read permission')
}

// Добавить флаг
permissions.add(EXECUTE)

// Удалить флаг
permissions.remove(WRITE)

// Переключить флаг
permissions.toggle(DELETE)
```

## API

Подробная документация доступна в исходном коде пакета.

## Лицензия

TVR
