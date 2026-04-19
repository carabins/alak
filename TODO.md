# Alaq Ecosystem TODO

## 1. CLI Tools
- [ ] **`packages/create-alaq`**: The project initializer.
    - [ ] Logic to prompt user for project type (Fullstack, Client-only).
    - [ ] Templates for Vue 3 + PixiJS and Golang.
    - [ ] Automatic `npm/bun install` and initial `alaq gen`.
- [ ] **`packages/cli` (published as `alaq`)**: The developer orchestrator.
    - [ ] `alaq dev`: Watch mode for schema changes + concurrent execution of client/server.
    - [ ] `alaq gen`: AOT compilation of GQL schema.
    - [ ] `alaq build`: Production bundling.

## 2. Project Topology (Generated Project)
- [ ] **Root**: `alaq.yaml` (config), `schema/` (GQL files).
- [ ] **Client**:
    - [ ] Virtual package in `node_modules/.alaq/alaqlink`.
    - [ ] **Naming**: Accessible via **`@alaqlink`** alias.
    - [ ] Vite plugin from `@alaq/flex/vite` for auto-config and auto-imports.
- [ ] **Server**:
    - [ ] Generated code in `internal/alaqlink`.
    - [ ] **Naming**: Go package name **`alaqlink`**.

## 3. Core Development
- [ ] **`@alaq/gql`**: Meta-compiler logic.
    - [ ] Support for `@qos`, `@auth`, `@scope`, and `@this`.
    - [ ] TS generator (Interfaces, SyncNodes).
    - [ ] Go generator (Structs, BaseServer).
- [ ] **`@alaq/link`**: Smart hybrid transport.
- [ ] **`@alaq/link-state`**: Client-side replica with Ghost Proxies.
- [ ] **`@alaq/flex`**: Functional UI components for PixiJS.

## 4. Naming Conventions
- Generated API package name (TS): **`@alaqlink`**
- Generated API package name (Go): **`alaqlink`**
- Alaq config file: **`alaq.yaml`**
