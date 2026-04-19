# @alaq/link Implementation Plan

## Phase 1: Core & System Drivers
*Goal: Basic connectivity and strategy selection.*

1.  **Scaffold Package**: Setup `package.yaml`, `tsconfig.json`.
2.  **Define Interfaces**: `LinkDriver`, `LinkHub`, `LinkChannel`, `LinkMessage`.
3.  **Implement `LinkHub`**:
    *   Peer management (Map<ID, Peer>).
    *   Strategy selection logic (Fastest vs Reliable).
4.  **Implement System Drivers**:
    *   `HttpDriver` (fetch wrapper).
    *   `WebSocketDriver` (standard API).
    *   `WebTransportDriver` (API check + DatagramWriter).

## Phase 2: Logic & Discovery
*Goal: Smart behaviors and "Cloud Echo".*

1.  **Implement "Smart Fallback"**:
    *   Logic to attempt WebTransport -> timeout -> WebSocket.
2.  **Implement "Reference Protocol"**:
    *   Logic to intercept "refer" messages and trigger `HttpDriver`.
3.  **Implement "Cloud Echo" (Browser LAN)**:
    *   IP Matching logic (server-side mock for now).
    *   WebRTC Handshake orchestration (via Signaling).

## Phase 3: Integration & Tooling
*Goal: DX and Code Generation.*

1.  **Golang Server Generator**:
    *   Structure for `quic-go` server.
    *   Multiplexing (WS + H3 on same port).
2.  **GQL Integration**:
    *   Mapping `@transport` directives to runtime `LinkHub` calls.
3.  **Docs Generation**:
    *   AsyncAPI export for WS/H3 channels.
    *   OpenAPI export for HTTP channels.
