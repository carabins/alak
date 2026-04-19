# @alaq/link: Smart Hybrid Transport

**The "Nervous System" of the Alaq Ecosystem.**

`@alaq/link` is an agnostic, multi-protocol transport layer designed for next-generation web applications and games. It abstracts away the complexity of choosing between WebTransport, WebSockets, HTTP, and WebRTC, providing a unified API for data synchronization.

---

## 1. Philosophy

### A. Agnostic & Adaptive
The application logic should not care *how* data is delivered. It only cares about the **intent** (e.g., "send this position update as fast as possible" or "reliably upload this file").
`LinkHub` automatically selects the best available driver based on the environment (Browser, Electron, Mobile) and network conditions (Corporate Firewall, Home Wi-Fi, 5G).

### B. HTTP/3 First, but Compatible
We bet on **WebTransport (QUIC)** as the future standard. It solves the Head-of-Line blocking problem and supports both reliable streams and unreliable datagrams.
However, we acknowledge the reality of 2026: firewalls exist. The system automatically falls back to **WebSocket (TCP)** or **HTTP/2** if UDP is blocked, ensuring 100% connectivity.

### C. Hybrid Topology (Mesh + Star)
Server-Client is not the only way. If two players are in the same room, why send data through a server 500km away?
`@alaq/link` attempts to establish **P2P connections (WebRTC)** for high-frequency gameplay data, using the server only for signaling and authoritative state.

---

## 2. Architecture

The system is built around a central hub and pluggable drivers.

### LinkHub (The Core)
The intelligent router.
*   Maintains a list of **Peers** (Server, other Clients).
*   Manages multiple **Channels** per Peer.
*   Routes messages based on **QoS (Quality of Service)** requirements defined in the GQL Schema.

### Drivers (The Plugins)
Drivers implement specific protocols. They handle connection lifecycle and raw data transfer.

1.  **`WebTransportDriver` (Primary Server Link)**
    *   Uses HTTP/3 (QUIC).
    *   Supports `datagrams` (Unreliable, Fast) and `streams` (Reliable).
    *   Ideal for real-time game state.

2.  **`WebSocketDriver` (Fallback Server Link)**
    *   Uses TCP.
    *   Guarantees delivery but suffers from HoL blocking.
    *   Used when QUIC is blocked.

3.  **`WebRTCDriver` (P2P Link)**
    *   Uses UDP/SCTP.
    *   Connects clients directly (Mesh).
    *   Essential for local multiplayer latency reduction.

4.  **`HttpDriver` (Lazy Data)**
    *   Standard `fetch`.
    *   Used for "Reference" protocol (downloading large datasets on demand).
    *   Supports HTTP/1.1, H2, and H3 automatically.

---

## 3. Key Features

### 📡 Cloud Echo (Local Discovery)
How to find players on the same Wi-Fi in a browser?
1.  Clients connect to the Server.
2.  Server matches public IPs.
3.  Server instructs clients to attempt a WebRTC handshake using local ICE candidates.
4.  If successful, clients are marked as "Local" and can switch to direct P2P communication.

### 🔄 Smart Fallback
1.  Attempt **WebTransport**.
2.  If fail (timeout/error) -> Upgrade to **WebSocket**.
3.  If fail (proxy blocks WS) -> Fallback to **HTTP/2 Long Polling / SSE**.

### 🧠 Adaptive Request Strategy
The server and client dynamically negotiate the best delivery method for each request based on data size and context.
*   **Small Data (e.g., Item Stats):** Returned immediately via the active Socket/QUIC stream (Low Latency).
*   **Large Request (e.g., Search with params):** Client sends arguments via `POST`.
*   **Large Response (e.g., Catalog):** Server responds with a "Reference" (URL). `LinkHub` automatically downloads it via `GET` (Caching friendly).

### 🕸️ Local Mesh (WiFi Direct)
Clients in the same room (behind the same NAT/WiFi) should not route high-frequency gameplay data through a remote server.
*   `@alaq/link` establishes direct **WebRTC** connections between local peers.
*   This creates a low-latency Mesh network for position/physics sync.
*   The central server remains the authority for critical state but offloads bandwidth.

### 📄 The "Reference" Protocol
For large data (e.g., Inventory Catalog), the server doesn't block the real-time socket.
1.  Server sends a lightweight "Pointer" (Ticket/URL).
2.  `LinkHub` detects the pointer and transparently fetches the data via `HttpDriver`.
3.  The application receives the resolved data promise.

---

## 4. Integration with @alaq/gql

`@alaq/link` is the runtime execution engine for the directives defined in the GQL Schema.

```graphql
type Player {
  # LinkHub uses WebTransport Datagrams (or WebRTC)
  pos: Vec2! @sync(qos: "unreliable", strategy: "p2p")
  
  # LinkHub uses WebTransport Stream (or WebSocket)
  score: Int! @sync(qos: "reliable")
  
  # LinkHub uses HttpDriver (GET /api/profile)
  profile: Profile! @transport(channel: "http")
}
```
