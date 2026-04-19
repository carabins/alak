# @alaq/link: Plugin System & Drivers

The core philosophy of `@alaq/link` is **modularity**. The logic for *how* to send data is completely separated from the logic of *what* to send.

## 1. Architecture

### LinkHub (The Kernel)
The `LinkHub` is a lightweight orchestrator. It does not know how to open a socket or send a fetch request. It relies entirely on **Drivers**.

### Drivers (The Plugins)
A Driver is a class that implements the `LinkDriver` interface.
Drivers can be:
1.  **System Drivers**: Built-in, enabled by default (Top-4).
2.  **Native Drivers**: Platform-specific (Tauri BLE, Electron TCP).
3.  **Custom Drivers**: User-defined (e.g., specific Mock driver for testing).

---

## 2. System Drivers (The Top-4)

These drivers are included in the core package but can be tree-shaken or disabled via configuration.

### 🥇 1. WebTransportDriver (HTTP/3)
*   **Role**: Primary Server Link (Next-Gen).
*   **Features**: `unreliable` (Datagrams), `reliable` (Streams), `multiplexing`.
*   **Status**: Default ON.

### 🥈 2. WebSocketDriver (TCP)
*   **Role**: Fallback Server Link (Legacy/Stable).
*   **Features**: `reliable` (TCP stream).
*   **Status**: Default ON (Automatic fallback if H3 fails).

### 🥉 3. WebRTCDriver (UDP P2P)
*   **Role**: Client-to-Client Mesh (Local WiFi & Internet).
*   **Features**: `p2p`, `unreliable` (UDP), `low-latency`.
*   **Status**: Default ON (Requires Signaling from Server). Enables direct communication between players in the same room.

### 🏅 4. HttpDriver (Fetch)
*   **Role**: Lazy Data & Large Payloads.
*   **Features**: `request-response`, `caching`, `resume`.
*   **Status**: Default ON. Used for "Reference Protocol" and adaptive `GET`/`POST` requests when data size exceeds socket thresholds.

---

## 3. Configuration & Optimization

Developers can strip down `@alaq/link` for specific environments (e.g., "Legacy Web" or "Local Only").

```typescript
// Example: Force HTTP/2 only (disable UDP/QUIC)
const link = new LinkHub({
  drivers: [
    // Disable WebTransport & WebRTC
    new WebSocketDriver(),
    new HttpDriver()
  ]
});
```

### Dynamic Loading
Drivers can be loaded dynamically.
*   *Scenario:* A user installs the "Pro" version of the app wrapper (Electron).
*   *Action:* App injects `ElectronZeroConfDriver` into the existing `LinkHub`. The game logic doesn't change, but suddenly LAN discovery works offline.
