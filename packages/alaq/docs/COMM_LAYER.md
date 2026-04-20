# ALAQ Comm Layer — Коммутируемая связь

> Q — это не state manager. Q — это коммутатор.
> `ask/tell/hear/call` — не "прочитай переменную", а "обратись по адресу".

## 1. Суть

Любая Q-операция — это сообщение с адресом и намерением. Куда это сообщение доставляется — в тот же процесс, на сервер через QUIC, в Rust-бэкенд через Tauri IPC, или на соседний телефон через BLE — решает **Router**. Прикладной код этого не знает и не должен знать.

```
Q.ask('game.player.hp')     // откуда придёт ответ? — неважно
Q.tell('chat.message', msg) // куда уйдёт? — неважно
Q.hear('room.state', fn)    // по какому каналу? — неважно
```

## 2. Четыре примитива

Весь обмен данными сводится к четырём операциям:

| Op | Семантика | Направление | Ожидание |
|----|-----------|-------------|----------|
| **READ** | Получить текущее значение | → target → ответ | Синхронно или async |
| **WRITE** | Установить значение | → target | Fire-and-forget или ack |
| **SUB** | Подписаться на изменения | → target → поток | Долгоживущий канал |
| **RPC** | Вызвать действие | → target → результат | Request-response |

Этого достаточно для любого взаимодействия — от чтения локальной переменной до вызова gRPC-метода на другом континенте.

## 3. Wire Message

Каждая Q-операция сериализуется в универсальное сообщение:

```
┌─── Header ──────────────────────────┐
│ op:      u8    (READ|WRITE|SUB|RPC) │
│ flags:   u8    (ack, stream, batch) │
│ seq:     u32   (monotonic counter)  │
│ path:    str   "game.player.hp"     │
├─── Envelope ────────────────────────┤
│ realm:   str   (source realm)       │
│ scope:   str   (room/session/global)│
│ auth:    bytes (token or scope id)  │
│ qos:     u8    (reliable/realtime)  │
├─── Payload ─────────────────────────┤
│ format:  u8    (codec id)           │
│ data:    bytes (encoded value)      │
└─────────────────────────────────────┘
```

**Format не фиксирован.** Кодек выбирается per-connection или per-message:

| ID | Codec | Когда |
|----|-------|-------|
| 0 | JSON | дебаг, HTTP fallback, совместимость |
| 1 | MessagePack | дефолт: компактный, без схемы, все языки |
| 2 | CBOR | IoT, BLE (ещё компактнее) |
| 3 | Protobuf | когда нужна строгая схема и максимальная скорость |
| 4 | FlatBuffers | zero-copy, gamedev hot path |
| 5 | Raw bytes | кастомный бинарный протокол |

Router и Adapter **договариваются** о кодеке при handshake. Внутри одного процесса сериализация не нужна — передаётся ссылка.

## 4. Router

Router — центральная точка. Он знает, какой realm обслуживается каким Adapter.

```typescript
router.bind('game.*',   serverAdapter)    // Go через QUIC
router.bind('ui.*',     localAdapter)     // тот же процесс
router.bind('sys.*',    tauriAdapter)     // Rust через IPC
router.bind('peer.*',   p2pAdapter)       // WebRTC mesh
router.bind('iot.*',    bleAdapter)       // Bluetooth LE
router.bind('legacy.*', httpAdapter)      // REST API
```

### Разрешение маршрута

```
Q.ask('game.player.hp')
  │
  ├─ Router.resolve('game.player.hp')
  │   ├─ match: 'game.*' → serverAdapter
  │   ├─ auth check: scope=room, role=member ✓
  │   └─ qos lookup: hp → RELIABLE
  │
  ├─ serverAdapter.read('player.hp', { qos: RELIABLE })
  │   ├─ serialize(msgpack)
  │   ├─ send via QUIC stream
  │   └─ await response
  │
  └─ deserialize → return value
```

### Fallback chain

Один realm может иметь несколько Adapter'ов с приоритетами:

```typescript
router.bind('game.*', [
  { adapter: quicAdapter,   priority: 1 },  // предпочтительный
  { adapter: wsAdapter,     priority: 2 },  // fallback
  { adapter: httpAdapter,   priority: 3 },  // последний рубеж
])
```

Router пробует по приоритету. Если QUIC недоступен (firewall) — переключается на WebSocket. Если и WS заблокирован — HTTP long polling.

## 5. Adapter Interface

Adapter — единственный контракт, который должен реализовать любой транспорт на любом языке:

```typescript
interface Adapter {
  // Идентификация
  readonly id: string
  readonly capabilities: Set<Capability>

  // Жизненный цикл
  connect(config: AdapterConfig): Promise<void>
  disconnect(): Promise<void>
  readonly state: 'idle' | 'connecting' | 'connected' | 'error'

  // Четыре примитива
  read(path: string, opts?: ReadOpts): Promise<any>
  write(path: string, value: any, opts?: WriteOpts): Promise<void>
  subscribe(path: string, listener: Listener, opts?: SubOpts): Unsubscribe
  invoke(path: string, args: any[], opts?: RpcOpts): Promise<any>
}

type Capability =
  | 'reliable'      // гарантированная доставка
  | 'realtime'      // datagrams / UDP
  | 'bidirectional' // полнодуплексный канал
  | 'p2p'           // прямое соединение
  | 'offline'       // работа без сети
  | 'broadcast'     // один ко многим
  | 'binary'        // бинарные payload
  | 'streaming'     // потоковая передача
```

## 6. Каталог транспортов

### Сетевые (Browser / Node / Bun)

| Adapter | Протокол | Capabilities | Когда |
|---------|----------|-------------|-------|
| **QuicAdapter** | HTTP/3, QUIC | reliable, realtime, bidirectional, binary, streaming | Основной серверный канал |
| **WsAdapter** | WebSocket | reliable, bidirectional | Fallback, legacy, широкая поддержка |
| **HttpAdapter** | HTTP/1.1, H2, H3 | reliable | REST, lazy data, большие payload |
| **SseAdapter** | Server-Sent Events | reliable, streaming | Однонаправленный поток, простота |
| **WebRtcAdapter** | WebRTC DataChannel | realtime, p2p, bidirectional, binary | P2P между браузерами |
| **GrpcAdapter** | gRPC (H2) | reliable, bidirectional, streaming, binary | Микросервисы, Go↔Go |
| **GrpcWebAdapter** | gRPC-Web | reliable, binary | Браузер → gRPC сервер |
| **MqttAdapter** | MQTT | reliable, broadcast | IoT, pub/sub сценарии |

### Platform / Native

| Adapter | Протокол | Capabilities | Когда |
|---------|----------|-------------|-------|
| **TauriIpcAdapter** | Tauri `invoke` / events | reliable, bidirectional | Webview ↔ Rust backend |
| **WailsAdapter** | Wails bindings | reliable, bidirectional | Webview ↔ Go backend |
| **ElectronIpcAdapter** | Electron IPC | reliable, bidirectional | Renderer ↔ Main process |
| **NodeIpcAdapter** | Unix socket / named pipe | reliable, bidirectional | Node ↔ Node (local) |
| **WorkerAdapter** | postMessage | reliable, bidirectional | Main thread ↔ Worker |
| **SharedWorkerAdapter** | SharedWorker port | reliable, bidirectional, broadcast | Между вкладками |
| **BroadcastAdapter** | BroadcastChannel | reliable, broadcast | Между вкладками (простой) |

### Hardware / IoT

| Adapter | Протокол | Capabilities | Когда |
|---------|----------|-------------|-------|
| **BleAdapter** | Bluetooth LE GATT | reliable, binary | Мобилка ↔ периферия |
| **SerialAdapter** | Web Serial / USB | reliable, binary, streaming | Микроконтроллеры |
| **NfcAdapter** | NFC NDEF | reliable | Tap-to-connect, передача токенов |
| **UsbHidAdapter** | WebHID | reliable, binary | Геймпады, кастомные устройства |

### Offline / Local

| Adapter | Протокол | Capabilities | Когда |
|---------|----------|-------------|-------|
| **LocalAdapter** | Прямой вызов (in-process) | все | Тот же процесс, zero overhead |
| **MdnsAdapter** | mDNS / DNS-SD | p2p, broadcast | Обнаружение в LAN без интернета |
| **StorageAdapter** | IndexedDB / SQLite | reliable, offline | Offline-first, persistence |
| **CrdtAdapter** | CRDT sync | reliable, p2p, offline | Conflict-free offline collaboration |

### Серверные (Go / Rust / Node)

| Adapter | Протокол | Capabilities | Когда |
|---------|----------|-------------|-------|
| **ChannelAdapter** | Go channels | reliable, bidirectional | Внутри Go-процесса |
| **TokioAdapter** | mpsc / oneshot | reliable, bidirectional | Внутри Rust-процесса |
| **NatsAdapter** | NATS | reliable, broadcast, streaming | Межсервисная связь |
| **RedisAdapter** | Redis Pub/Sub + Streams | reliable, broadcast | Shared state, pub/sub |
| **UnixSocketAdapter** | UDS | reliable, bidirectional, binary | Локальные сервисы |

## 7. Auth & Permissions

Авторизация — часть Router, не Adapter. Adapter доставляет, Router решает **можно ли**.

### Уровни доступа

```
public  → все могут читать/писать
owner   → только владелец объекта
room    → участники комнаты/scope
server  → только серверная логика
admin   → административный доступ
custom  → пользовательская логика
```

### Декларация (из GQL-схемы)

```graphql
type Player @scope(name: "room") {
  name:      String!  @auth(read: room,   write: owner)
  hp:        Int!     @auth(read: room,   write: server)
  pos:       Vec2!    @auth(read: room,   write: owner)
  inventory: [Item!]! @auth(read: owner,  write: server)
  adminNote: String   @auth(read: admin,  write: admin)
}
```

### Enforcement

```
Q.tell('game.player.hp', 100)
  │
  Router:
  ├─ who: client (role=player, id=42)
  ├─ path: game.player.hp
  ├─ op: WRITE
  ├─ rule: write=server
  └─ DENIED: client не может писать hp
     → Error: PermissionDenied('player.hp requires server write')
```

Правила проверяются **на обоих концах**:
- **Клиент** (Router) — раннее отсечение, не отправляет заведомо невалидное
- **Сервер** — авторитетная проверка, клиенту не доверяем

### Token Propagation

```
Client            Router           Adapter          Server
  │                  │                │                │
  │ Q.ask(path)      │                │                │
  ├─────────────────►│                │                │
  │                  │ attach token   │                │
  │                  ├───────────────►│                │
  │                  │                │ send(msg+auth) │
  │                  │                ├───────────────►│
  │                  │                │                │ verify token
  │                  │                │                │ check scope
  │                  │                │    response    │
  │                  │                │◄───────────────┤
  │      value       │                │                │
  │◄─────────────────┤                │                │
```

Router прикрепляет auth-данные к сообщению автоматически. Adapter не занимается авторизацией — он только доставляет.

## 8. QoS Negotiation

Каждое поле в схеме имеет требуемый QoS. Router подбирает Adapter, который его поддерживает:

```
Schema:  pos: Vec2! @sync(qos: REALTIME)

Router:
  ├─ нужно: realtime capability
  ├─ available adapters for 'game.*':
  │   ├─ QuicAdapter  [reliable, realtime, bidirectional] ✓
  │   ├─ WsAdapter    [reliable, bidirectional]           ✗ нет realtime
  │   └─ HttpAdapter  [reliable]                          ✗
  └─ выбран: QuicAdapter (datagrams)
```

Если realtime-adapter недоступен, Router может:
1. **Деградировать** — отправить reliable с предупреждением
2. **Отказать** — если деградация неприемлема (настраивается)
3. **Буферизовать** — накопить и отправить batch

## 9. Кросс-языковой контракт

Q-протокол должен работать одинаково в каждом языке. Серверный Go и клиентский TS общаются через один wire format.

### Go

```go
// Сгенерированный код
type PlayerRouter struct {
    router alaq.Router
}

func (r *PlayerRouter) HandleRead(path string, ctx alaq.Context) (any, error) {
    switch path {
    case "hp":
        if !ctx.HasAccess(alaq.RoleRoom) {
            return nil, alaq.ErrPermissionDenied
        }
        return r.player.HP, nil
    }
}

func (r *PlayerRouter) HandleWrite(path string, value any, ctx alaq.Context) error {
    switch path {
    case "pos":
        if ctx.SenderID != r.player.OwnerID {
            return alaq.ErrPermissionDenied
        }
        r.player.Pos = value.(Vec2)
        r.router.Notify("player.pos", value) // → SUB listeners
        return nil
    }
}
```

### Rust (Tauri backend)

```rust
// Сгенерированный код
#[alaq::handler]
impl PlayerHandler {
    #[alaq::read(auth = "room")]
    async fn hp(&self) -> i32 {
        self.player.hp
    }

    #[alaq::write(auth = "owner")]
    async fn pos(&mut self, value: Vec2) {
        self.player.pos = value;
        self.notify("player.pos", &value);
    }
}
```

### TypeScript (клиент)

```typescript
// Прикладной код — одинаковый независимо от транспорта
Q.ask('game.player.hp')              // → Go server через QUIC
Q.ask('sys.window.size')             // → Rust через Tauri IPC
Q.ask('ui.counter.count')            // → local (тот же процесс)
Q.hear('peer.player2.pos', fn)       // → WebRTC P2P
```

## 10. Multi-Adapter Scenarios

### Сценарий: Мультиплеерная игра в Tauri

```
┌─── Tauri App ──────────────────────────────────────┐
│                                                     │
│  ┌─── Webview (TS) ───────────────────────────┐    │
│  │                                             │    │
│  │  Q.ask('game.room.state')  ──┐              │    │
│  │  Q.tell('game.me.pos', xy)   │              │    │
│  │  Q.hear('game.enemy.pos')    │              │    │
│  │  Q.ask('sys.audio.volume') ──┼─ TauriIPC ──┼──► Rust backend
│  │  Q.ask('ui.menu.visible')  ──┼─ Local       │    │
│  │  Q.hear('peer.p2.pos')  ────┼─ WebRTC ─────┼──► другой игрок
│  │                              │              │    │
│  │         Router               │              │    │
│  │  game.* → QuicAdapter ──────┼──────────────┼──► Go game server
│  │  sys.*  → TauriIpcAdapter ──┘              │    │
│  │  ui.*   → LocalAdapter                     │    │
│  │  peer.* → WebRtcAdapter                    │    │
│  │                                             │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ┌─── Rust Backend ────────────────────────────┐    │
│  │  sys.audio.* → LocalAdapter (Rust)          │    │
│  │  sys.files.* → LocalAdapter (Rust)          │    │
│  │  game.*      → QuicAdapter → Go server      │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### Сценарий: Offline-first с синхронизацией

```
Online:
  game.* → QuicAdapter → server

Offline (автоматически):
  game.* → StorageAdapter → IndexedDB (local writes)
           + CrdtAdapter  → accumulate changes

Reconnect:
  CrdtAdapter → merge → QuicAdapter → server
  server → resolve conflicts → QuicAdapter → client
```

### Сценарий: IoT Dashboard

```
iot.sensor.*  → MqttAdapter → MQTT broker → устройства
iot.control.* → BleAdapter  → Bluetooth → контроллер
data.*        → HttpAdapter → REST API
ui.*          → LocalAdapter
```

## 11. Кодогенерация

`@alaq/gql` генерирует:

| Из схемы | TypeScript | Go | Rust |
|----------|-----------|-----|------|
| `type Player { hp: Int! }` | Interface + SyncNode | Struct + Handler | Struct + Handler |
| `@sync(qos: REALTIME)` | QoS hint для Router | Datagram handler | Datagram handler |
| `@auth(read: room)` | Client-side guard | Server-side check | Server-side check |
| `@scope(name: "room")` | Scoped subscription | Scoped lifecycle | Scoped lifecycle |
| `extend type Mutation` | RPC method | Handler method | Handler method |

Дополнительно генерирует:
- **Wire types** — общая schema для выбранного кодека (Protobuf/MessagePack schema)
- **Router config** — маппинг realm → adapter на основе `@sync` директив
- **Permission matrix** — таблица прав для быстрой проверки

## 12. Mesh-First: распределённая топология

Секции 4-8 описывают Router как центральную точку — **star topology**. Это работает для "клиент → сервер", но не покрывает главного: ситуаций, когда **нет центра**.

Zenoh, libp2p, NATS — все они решают одну задачу: дать каждому узлу возможность публиковать и подписываться **без знания о топологии**. Q-протокол должен работать так же.

### 12.1. Почему mesh — не опция, а фундамент

Примеры из реальных сценариев alaq:

| Сценарий | Топология | Почему star не работает |
|----------|-----------|----------------------|
| Шляпа в комнате, 6 телефонов, нет интернета | Full mesh | Нет сервера вообще |
| Tauri + Go сервер + 3 игрока | Hybrid star+mesh | Позиции через P2P, состояние через сервер |
| IoT: 20 датчиков + контроллер + dashboard | Tree mesh | Датчики общаются друг с другом, контроллер агрегирует |
| Colab-редактор, offline-capable | CRDT mesh | Каждый узел = авторитет своих правок |
| Микросервисы: 5 Go-сервисов | Service mesh | Нет единого роутера, каждый сервис — peer |

Вывод: **Router должен быть распределённым**. Каждый узел в сети — это Router со своей таблицей маршрутов, и эти таблицы синхронизируются.

### 12.2. Пространство ключей (Key Space)

Вдохновлено Zenoh: Q-пути — это уже key expressions, совместимые с pub/sub/query.

```
Q path:           game/room/42/player/7/pos
Zenoh key expr:   game/room/42/player/*/pos     (wildcard)
                  game/room/42/**               (recursive wildcard)
```

Q-путь с точками (`game.room.42.player.7.pos`) маппится на иерархический key space.
Это даёт:

- **Pattern-based subscription**: `Q.hear('game.room.42.player.*', fn)` — все игроки в комнате
- **Discovery**: `Q.ask('game.room.*')` — какие комнаты существуют?
- **Aggregation**: `Q.ask('game.room.42.player.*.score')` → собрать скоры всех игроков

### 12.3. Роли узлов

Каждый процесс в сети — это **Node**. Узлы различаются по роли:

| Роль | Аналог Zenoh | Что делает | Пример |
|------|-------------|------------|--------|
| **Peer** | Peer | Полноценный участник: pub/sub/query, маршрутизация для соседей | Go game server, Tauri Rust backend |
| **Client** | Client | Подключается к Peer, не маршрутизирует чужой трафик | Браузер, мобильное приложение |
| **Relay** | Router | Соединяет сегменты сети, маршрутизирует, не хранит state | Edge-прокси, NAT traversal relay |
| **Bridge** | Plugin | Мост между протоколами (WebSocket ↔ QUIC ↔ BLE) | Gateway IoT → Cloud |

```
                    ┌──────────┐
                    │  Relay   │ (Cloud, NAT traversal)
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              │                     │
         ┌────▼────┐          ┌────▼────┐
         │  Peer   │◄────────►│  Peer   │
         │ Go srv  │  QUIC    │ Go srv  │
         └────┬────┘          └────┬────┘
              │                    │
     ┌────────┼──────┐        ┌───┼────────┐
     │        │      │        │   │        │
  ┌──▼──┐ ┌──▼──┐ ┌─▼───┐ ┌─▼──┐│ ┌──▼──┐
  │ Cli │ │ Cli │ │ Cli │ │Cli ││ │ Cli │
  │ Brw │ │ Brw │ │Tauri│ │Brw ││ │ Brw │
  └─────┘ └─────┘ └──┬──┘ └────┘│ └─────┘
                      │          │
                   ┌──▼──┐    ┌──▼──┐
                   │Peer │    │Peer │
                   │Rust │    │ IoT │
                   └─────┘    └─────┘
```

### 12.4. Scouting (Обнаружение)

Как узлы находят друг друга? Несколько механизмов, работающих одновременно:

```typescript
const node = new AlaqNode({
  scouting: {
    // 1. Multicast — LAN без интернета
    multicast: {
      enabled: true,
      address: '224.0.0.224:7447',    // как Zenoh
      interface: 'auto'               // автовыбор сетевого интерфейса
    },

    // 2. Gossip — узлы обмениваются списками соседей
    gossip: {
      enabled: true,
      autoconnect: { router: true, peer: true, client: false }
    },

    // 3. Bootstrap — известные seed-узлы
    seeds: [
      'quic/game.example.com:443',
      'ws/fallback.example.com:80'
    ],

    // 4. mDNS — DNS-SD для LAN
    mdns: {
      enabled: true,
      serviceType: '_alaq._udp'
    },

    // 5. BLE beacon — обнаружение через Bluetooth
    ble: {
      enabled: false,                  // opt-in
      serviceUUID: 'alaq-game-xxx'
    }
  }
})
```

Результат scouting — **динамическая таблица пиров**. Router использует её для маршрутизации.

### 12.5. Distributed Router

В mesh-топологии Router на каждом узле работает иначе. Он не знает всю сеть — он знает **своих соседей** и **свои ресурсы**.

```
Node A (browser, game client):
  ┌─ Local resources ─────────────────┐
  │  ui.*     → LocalAdapter          │
  │  me.*     → LocalAdapter          │
  └───────────────────────────────────┘
  ┌─ Known peers ─────────────────────┐
  │  Node B (Go server)  via QUIC     │
  │  Node C (player 2)   via WebRTC   │
  │  Node D (Tauri host) via WS       │
  └───────────────────────────────────┘

Q.ask('game.room.state')
  → not local
  → who declares 'game.*'?
  → Node B announces 'game.**' capability
  → route to Node B via QUIC

Q.hear('peer.c.pos')
  → Node C announces 'peer.c.**'
  → route to Node C via WebRTC (direct, low latency)
```

### 12.6. Resource Declaration

Каждый узел объявляет, какие key-пространства он обслуживает:

```typescript
// Go server
node.declare('game/**', {
  operations: ['read', 'write', 'sub', 'rpc'],
  qos: { default: 'reliable', overrides: { '*/pos': 'realtime' } },
  auth: 'required'
})

// Tauri Rust backend
node.declare('sys/**', {
  operations: ['read', 'write', 'rpc'],
  scope: 'local'          // не анонсировать в сеть
})

// Игрок (browser)
node.declare('me/**', {
  operations: ['read', 'sub'],
  scope: 'room'           // видно участникам комнаты
})
```

Объявления распространяются через gossip или scouting. Каждый узел знает, кто какие ключи обслуживает, и может маршрутизировать.

### 12.7. Топологии

Q-протокол поддерживает любую топологию — выбор определяется конфигурацией:

#### Star (Classic client-server)

```
  C ──► S ◄── C
        ▲
        │
        C
```

Один Peer-сервер, остальные — Client. Самый простой случай. Router на клиентах знает один маршрут: "всё → сервер".

#### Full Mesh (Serverless local game)

```
  P ◄──► P
  ▲ ╲  ╱ ▲
  │  ╲╱  │
  │  ╱╲  │
  ▼ ╱  ╲ ▼
  P ◄──► P
```

Все узлы — Peer. Каждый знает каждого. Идеально для 4-8 игроков в одной комнате. Scouting через multicast/mDNS.

#### Hybrid (Game with authority server)

```
        ┌───┐
    ┌──►│ S │◄──┐         S = Authoritative Peer
    │   └───┘   │         P = Player Peers
    │     ▲     │
  ┌─▼─┐  │  ┌──▼┐        S handles: game.state, game.score
  │ P ├──┘  │ P │        P↔P handles: player.pos, player.anim
  └─┬─┘     └─┬─┘
    │          │
    └──── ◄────┘  P2P (realtime only)
```

Сервер — авторитет для критического состояния. Позиции и анимации — напрямую P2P. Router знает: `game.state` → server, `peer.*.pos` → direct P2P.

#### Tree (IoT / Edge)

```
     ┌─────┐
     │Cloud│
     └──┬──┘
    ┌───┼───┐
  ┌─▼─┐   ┌▼──┐
  │Edg│   │Edg│    Edge = Relay + aggregation
  └─┬─┘   └─┬─┘
  ┌─┼─┐   ┌─┼─┐
  │ │ │   │ │ │    Leaf = IoT devices (Client/Peer)
  S S S   S S S
```

Leaf-устройства общаются с Edge. Edge агрегирует и передаёт в Cloud. Обратная связь: Cloud → Edge → Leaf.

#### Routed Mesh (Internet-scale, Zenoh-style)

```
  ┌──────┐     ┌──────┐     ┌──────┐
  │ R-EU │◄───►│ R-US │◄───►│ R-AS │   R = Router/Relay
  └──┬───┘     └──┬───┘     └──┬───┘
  ┌──┼──┐     ┌───┼──┐     ┌──┼──┐
  P  P  P     P   P  P     P  P  P     P = Peer
  │        │           │
  C C      C C         C C             C = Client
```

Relay-узлы соединяют сегменты. Peer обслуживает клиентов. Gossip + routing tables обеспечивают глобальную адресацию. Q-путь `game.eu.room42.player.7.pos` маршрутизируется через EU relay.

### 12.8. Authority & Conflict Resolution

В mesh без единого сервера возникает вопрос: **кто прав?**

#### Стратегии (из GQL-схемы)

```graphql
type GameRoom @scope(name: "room") {
  # Один авторитет — хост комнаты
  state: GameState! @authority(mode: SINGLE, role: host)

  # Каждый игрок — авторитет своих данных
  players: [Player!]! @authority(mode: OWNER)

  # Никто не авторитет — CRDT merge
  chat: [Message!]! @authority(mode: CRDT, type: RGA)

  # Сервер — абсолютный авторитет (если есть)
  leaderboard: [Score!]! @authority(mode: SERVER)

  # Голосование — консенсус большинства
  settings: RoomSettings! @authority(mode: VOTE, quorum: 0.5)
}
```

| Mode | Кто решает | Конфликт | Когда |
|------|-----------|----------|-------|
| **SINGLE** | Назначенный хост | Хост выигрывает всегда | Игровое состояние |
| **OWNER** | Владелец данных | Только владелец пишет | Позиция игрока |
| **SERVER** | Серверный процесс | Сервер = единственная правда | Лидерборд, валюта |
| **CRDT** | Все, автомёрж | Бесконфликтный тип данных | Чат, colab-документ |
| **VOTE** | Кворум участников | Принимается большинством | Настройки комнаты |
| **LWW** | Последний писатель | Last-write-wins, timestamp | Простые настройки |

#### Host Migration

В mesh без сервера "хост" может отключиться. Протокол должен уметь:

```
1. Host (Node A) disconnects
2. Remaining peers detect via heartbeat timeout
3. Election:
   ├─ Lowest peer-id wins (deterministic, no voting)
   ├─ или: highest uptime wins
   └─ или: explicit successor list (A назначил B заранее)
4. New host (Node B) announces: declare('game/**', ...)
5. All peers update routing tables
6. State reconciliation:
   ├─ New host has latest snapshot? → continue
   └─ No? → peers send their last known state → merge
```

### 12.9. Transport Mesh Protocol

Как Q-сообщения маршрутизируются через mesh:

#### Routing Table (на каждом узле)

```
┌─────────────────────────────────────────────────────────┐
│  Key Pattern         │ Next Hop  │ Hops │ QoS      │ TTL│
├──────────────────────┼───────────┼──────┼──────────┼────┤
│  game/**             │ Node-S    │ 1    │ reliable │ ∞  │
│  peer/node-c/**      │ Node-C    │ 1    │ realtime │ 30s│
│  peer/node-d/**      │ Node-C    │ 2    │ realtime │ 30s│  ← через Node-C
│  sys/**              │ local     │ 0    │ reliable │ ∞  │
│  iot/sensor/**       │ Node-Edge │ 1    │ reliable │ 60s│
└──────────────────────┴───────────┴──────┴──────────┴────┘
```

#### Message Routing

```
Node A: Q.tell('peer.d.pos', xy)
  │
  Router (Node A):
  ├─ lookup 'peer.d.**' → next hop = Node-C, hops = 2
  ├─ wrap: { op: WRITE, path: 'peer.d.pos', data: xy, ttl: 2 }
  └─ send to Node-C

Node C (relay):
  ├─ ttl-- → ttl = 1
  ├─ lookup 'peer.d.**' → next hop = Node-D, hops = 1
  └─ forward to Node-D

Node D (destination):
  ├─ path matches local resource
  └─ apply write
```

#### Subscription Propagation

```
Node A: Q.hear('game.room.42.player.*.score', fn)
  │
  Router (Node A):
  ├─ no local match
  ├─ propagate SUB interest to neighbors
  └─ send SUB { pattern: 'game.room.42.player.*.score' } → Node-S

Node S (server):
  ├─ registers interest from Node-A
  ├─ when any player.*.score changes:
  │   └─ push to Node-A
  └─ cleanup when Node-A unsubscribes or disconnects
```

### 12.10. Zenoh-like Primitives Mapping

Q-операции идеально маппятся на Zenoh-примитивы:

| Q | Zenoh | Семантика |
|---|-------|-----------|
| `Q.tell(path, value)` | `put(key, value)` | Публикация значения |
| `Q.ask(path)` | `get(key)` | Query: запросить текущее значение у владельца |
| `Q.hear(path, fn)` | `subscribe(key)` | Подписка на изменения |
| `Q.call(path, ...args)` | `get(key) + eval` | Queryable: удалённый вычислитель |
| — | `delete(key)` | Q.tell(path, undefined) или Q.decay(path) |
| `Q.hear('game.**', fn)` | `subscribe('game/**')` | Wildcard subscription |

Это не совпадение. Zenoh доказал, что pub/sub/query — это минимальный полный набор для распределённой коммуникации. Q пришёл к тем же примитивам из другой стороны (state management).

### 12.11. Адаптация для Zenoh Protocol

Zenoh можно использовать как **нативный транспорт** для Q-сообщений:

```typescript
// ZenohAdapter — прямой мост Q ↔ Zenoh network
const zenohAdapter = new ZenohAdapter({
  mode: 'peer',                    // peer | client | router
  connect: ['tcp/server:7447'],    // или multicast scouting
  listen: ['udp/0.0.0.0:7447']    // принимать входящие
})

router.bind('**', zenohAdapter)    // весь key space через Zenoh
```

Когда Zenoh — транспорт, Router становится тонкой прослойкой:
Q-path маппится 1:1 на Zenoh key expression, операции маппятся на put/get/subscribe. Вся маршрутизация, scouting, mesh-forwarding — на стороне Zenoh.

Но Zenoh — **не единственный вариант**. Q-протокол может использовать любую mesh-библиотеку:

| Mesh Library | Язык | Сильные стороны | Как Q-адаптер |
|-------------|------|----------------|---------------|
| **Zenoh** | Rust, C, Python, TS(wasm) | Pub/sub/query, scouting, zero-copy, fog computing | Нативный маппинг Q→Zenoh |
| **libp2p** | Go, Rust, JS | DHT, NAT traversal, protocol negotiation | Q поверх pubsub + DHT |
| **NATS** | Go | Jetstream, subject-based routing, кластеризация | Q-subject → NATS subject |
| **ZeroMQ** | C, все | Паттерны (PUB/SUB, REQ/REP, PUSH/PULL), raw speed | Q-op → ZMQ socket type |
| **iroh** | Rust | Magicsock (QUIC + relay), content-addressable | Q + hash-based addressing |
| **Veilid** | Rust | Privacy-first DHT, encrypted routing | Secure Q messaging |

### 12.12. Mesh Capabilities Extension

Для mesh-транспортов расширяем набор Capability:

```typescript
type Capability =
  // ... existing ...
  | 'mesh'           // узел может маршрутизировать чужой трафик
  | 'scouting'       // автообнаружение соседей
  | 'wildcard-sub'   // подписка по паттерну (game/**)
  | 'queryable'      // может отвечать на get-запросы по паттерну
  | 'multipath'      // несколько путей до destination (redundancy)
  | 'nat-traversal'  // пробивка NAT без relay
  | 'content-routing'// маршрутизация по содержимому (DHT)
  | 'encryption'     // e2e шифрование между узлами
  | 'compression'    // сжатие на транспортном уровне
  | 'priority'       // приоритизация трафика (QoS levels)
  | 'congestion'     // контроль перегрузки (backpressure)
```

### 12.13. Пример: Шляпа без сервера

Полный сценарий — 6 телефонов в одной комнате, нет интернета:

```
Фаза 1: Scouting
  Телефон-1 запускает игру:
    node.listen('multicast/224.0.0.224:7447')
    node.declare('game/room/abc/**', { authority: SINGLE, role: host })
    node.declare('me/player-1/**', { authority: OWNER })

  Телефоны 2-6 открывают приложение:
    node.scout('multicast')  → обнаруживают Телефон-1
    node.connect(peer1)
    node.declare('me/player-N/**', { authority: OWNER })

Фаза 2: Mesh Formation
  ┌───┐   ┌───┐   ┌───┐
  │ 1 ├───┤ 2 ├───┤ 3 │
  └─┬─┘   └─┬─┘   └─┬─┘
    │   ╲ ╱  │   ╲ ╱  │
    │    ╳   │    ╳    │
    │   ╱ ╲  │   ╱ ╲   │
  ┌─┴─┐   ┌─┴─┐   ┌─┴─┐
  │ 4 ├───┤ 5 ├───┤ 6 │
  └───┘   └───┘   └───┘

  Каждый телефон напрямую связан с 2-3 соседями.
  Gossip обеспечивает полную routing table за 2-3 hop.

Фаза 3: Gameplay
  // На Телефон-3 (активный игрок):
  Q.ask('game.room.abc.currentWord')
    → route: game/** → Телефон-1 (host) → via Телефон-2 (1 hop)
    → return: "крокодил"

  Q.tell('me.player-3.guessing', true)
    → local write + publish to mesh
    → все получают обновление

  Q.call('game.room.abc.wordGuessed', { by: 'team-a' })
    → route to host (Телефон-1)
    → host updates score, publishes game.room.abc.score

Фаза 4: Host Migration
  Телефон-1 садится батарейка:
    → peers detect heartbeat miss (2s timeout)
    → election: Телефон-2 (lowest id among connected)
    → Телефон-2 declares 'game/room/abc/**'
    → state reconciliation from peers
    → game continues seamlessly
```

## 13. Принципы

1. **Adapter не знает про бизнес-логику.** Он только доставляет bytes между точками.
2. **Router не знает про протоколы.** Он только выбирает Adapter и проверяет права.
3. **Q не знает про Router.** Он только формулирует намерение (read/write/sub/rpc).
4. **Схема — единственный источник правды.** Из неё генерируются типы, права, QoS-хинты, wire format.
5. **Кодек — не часть протокола.** Он выбирается per-connection и может меняться на лету.
6. **Авторизация — на обоих концах.** Клиент фильтрует заведомо невалидное, сервер — авторитетно проверяет.
7. **Деградация предпочтительнее отказа.** Если идеальный транспорт недоступен — используем fallback, уведомив приложение.
8. **Mesh — не надстройка, а фундамент.** Star topology — частный случай mesh с одним relay. Архитектура не должна предполагать наличие центра.
9. **Топология — конфигурация, не код.** Один и тот же прикладной код (`Q.ask/tell/hear/call`) работает в star, mesh, hybrid, tree без изменений. Меняется только конфиг scouting и node role.
10. **Каждый узел — Router.** Нет привилегированной точки маршрутизации. Routing table распределена и синхронизируется через gossip/scouting.
11. **Authority — явная.** В mesh без сервера вопрос "кто прав" решается декларативно через `@authority` в схеме, не имплицитно.
