# @alaq/rune

> Утилиты для генерации криптографически стойких случайных строк

Легковесная библиотека для генерации случайных строк (runes) с поддержкой браузера и Node.js.

## Установка

```bash
npm install @alaq/rune
```

## Использование

```typescript
import { makeRune } from '@alaq/rune'

// Генерация случайной строки длиной 16 символов
const id = makeRune(16)
console.log(id) // "a3F9kL2mN8pQ4rT5"

// Для уникальных ID
const userId = makeRune(24)
const sessionId = makeRune(32)
```

## API

### `makeRune(length: number): string`

Генерирует случайную строку заданной длины.

**Параметры:**
- `length` - длина генерируемой строки

**Возвращает:**
- Случайную строку из букв (a-z, A-Z) и цифр (0-9)

**Особенности:**
- В браузере использует `crypto.getRandomValues()` (если доступно)
- В Node.js использует `crypto.randomBytes()`
- Fallback на `Math.random()` если crypto недоступно

## Лицензия

TVR
