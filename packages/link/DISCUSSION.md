# Discussion & Open Questions

This document captures context and open questions regarding the `@alaq/link` and `@alaq/gql` ecosystem.

## 1. Documentation Generation (OpenAPI / AsyncAPI)
*   **Context:** We are building a complex hybrid API (HTTP + Socket + QUIC). Manually writing docs is error-prone.
*   **Idea:** The `@alaq/gql` generator should produce standard documentation formats.
*   **Strategy:**
    *   `Query` fields with `@transport(channel: "http")` -> **OpenAPI (Swagger)** definition.
    *   `Subscription` / `Mutation` via Socket -> **AsyncAPI** definition.
*   **Question:** Should we embed a Swagger UI / AsyncAPI Playground into the generated Dev Server?

## 2. Server Generation (Golang)
*   **Context:** Go is the chosen backend.
*   **Libraries:** `quic-go` is the standard for QUIC.
*   **Challenge:** How to map `DeepState` (JS Proxy) to Go Structs?
    *   *Option A:* Generate struct with Mutexes.
    *   *Option B:* Use atomic primitives for simple fields.
*   **Transport:** How to handle "Multiplexing" (listening on same port for UDP/QUIC and TCP/WS)?
    *   *Solution:* Use a standard pattern where `http.Server` handles H1/H2/WS, and `quic-go` listens on UDP 443.

## 3. Native Integrations (Tauri / Electron)
*   **Context:** Moving beyond the browser.
*   **Bluetooth (BLE):**
    *   Need a standardized schema for BLE packets (limited payload size).
*   **mDNS (ZeroConf):**
    *   Allows finding peers without any Internet connection (Offline LAN).
*   **Implementation:** These should be separate packages (`@alaq/link-tauri`, etc.) that inject drivers into `LinkHub`.

## 4. "Boring App" Support (Admin Panels)
*   **Context:** Ensuring the stack works for dashboards, not just games.
*   **Feature:** `Stateless Mode`.
*   **Mechanism:** `LinkHub` should support a mode where it opens a connection, sends a request, and closes it (or keeps it idle but doesn't expect real-time ticks), essentially acting as a super-powered `fetch` wrapper.
