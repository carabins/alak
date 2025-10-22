# @alaq/ws

> WebSocket клиент с автоматическим реконнектом и поддержкой nucleus

Реактивный WebSocket клиент, построенный на nucleus с автоматическим переподключением и очередью сообщений.

## Установка

```bash
npm install @alaq/ws
```

## Использование

### Пример 1: Базовое подключение

```typescript
import WsClient from '@alaq/ws'

const ws = WsClient({
  url: 'ws://localhost:3000',
  reconnect: true,
  autoJson: true
})

// Подписаться на данные
ws.data.up((message) => {
  console.log('Received:', message)
})

// Отправить данные
ws.send({ type: 'ping' })
```

### Пример 2: Отслеживание состояния подключения

```typescript
const ws = WsClient()

ws.isConnected.up((connected) => {
  if (connected) {
    console.log('Connected to server')
    ws.send({ type: 'auth', token: 'xyz' })
  } else {
    console.log('Disconnected')
  }
})

// Обработка ошибок
ws.error.up((err) => {
  console.error('WebSocket error:', err)
})
```

### Пример 3: Интеграция с Vue

```vue
<script setup>
import { ref } from 'vue'
import WsClient from '@alaq/ws'
import { vueNucleon } from '@alaq/vue'

const ws = WsClient({ url: 'ws://localhost:8080' })

const isConnected = vueNucleon(ws.isConnected)
const messages = ref([])

ws.data.up((msg) => {
  messages.value.push(msg)
})

const sendMessage = (text) => {
  ws.send({ text, timestamp: Date.now() })
}
</script>

<template>
  <div>
    <div :class="{ online: isConnected, offline: !isConnected }">
      {{ isConnected ? 'Online' : 'Offline' }}
    </div>
    <ul>
      <li v-for="msg in messages" :key="msg.timestamp">
        {{ msg.text }}
      </li>
    </ul>
  </div>
</template>
```

## API

### `WsClient(options)`

**Опции:**

| Опция | Тип | По умолчанию | Описание |
|-------|-----|--------------|----------|
| `url` | `string` | `ws://[host]` | URL WebSocket сервера |
| `reconnect` | `boolean` | `true` | Автоматическое переподключение |
| `queue` | `boolean` | `true` | Очередь сообщений при отключении |
| `autoJson` | `boolean` | `true` | Автоматическая сериализация/парсинг JSON |
| `recConnectIntensity` | `number` | `24` | Интенсивность реконнекта |

**Возвращаемый объект:**

```typescript
{
  isConnected: INucleus<boolean>,  // Состояние подключения
  send: INucleus<any>,             // Отправка данных
  sendRaw: (data: string) => void, // Отправка сырых данных
  data: INucleus<any>,             // Входящие JSON данные
  raw: INucleus<string>,           // Входящие сырые данные
  ws: INucleus<WebSocket>,         // WebSocket инстанс
  error: INucleus<any>             // Ошибки
}
```

## Возможности

- ✅ Автоматическое переподключение с экспоненциальной задержкой
- ✅ Очередь сообщений при отключении
- ✅ Автоматическая сериализация/парсинг JSON
- ✅ Реактивное состояние подключения
- ✅ Обработка ошибок
- ✅ TypeScript типизация

## Зависимости

Требует `@alaq/nucleus`

## Лицензия

TVR
