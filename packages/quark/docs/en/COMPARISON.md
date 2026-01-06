# Comparison: Quark vs Signals vs Observables

This document provides a technical comparison between **@alaq/quark**, modern **Signals** (like in SolidJS, Preact, Vue), and **Observables** (RxJS).

## At a Glance

| Feature | @alaq/quark | Signals (Solid/Preact) | Observables (RxJS) |
| :--- | :--- | :--- | :--- |
| **Primary Goal** | **Performance & Memory** | DX & Auto-tracking | Complex Event composition |
| **Data Flow** | Atomic + Event Bus | Dependency Graph | Push-based Streams |
| **Memory Model** | **Monomorphic Class** | Linked Lists / Nodes | Chain of Closures/Objects |
| **Update Cost** | Near Zero (Direct Call) | Graph Traversal | Operator Chain Execution |
| **Dependency Tracking** | Manual (`.up`) / Explicit | **Automatic** (Magic) | Explicit (`.pipe`, `.subscribe`) |
| **Cross-Module Comms** | **Native (Realms)** | Context / Props | Subjects |

---

## 1. vs Observables (RxJS)

RxJS is the industry standard for handling complex asynchronous streams. However, for managing application state, it is often overkill and heavy.

### Memory Layout
*   **RxJS:** Creating a stream often involves creating multiple closure scopes and objects (Observable -> Operator -> Subscriber). Each subscription creates a new `Subscription` object.
*   **Quark:** A Quark is a single object with a predictable V8 "Hidden Class". It does not allocate closures per instance. The listeners are stored in a simple array.

### Performance
*   **RxJS:** Updating a value triggers a chain of function calls through the operator pipeline.
*   **Quark:** Updating a value is a direct array iteration: `for (let i=0; i<len; i++) listeners[i](val)`. It is closer to a native CPU instruction than a framework abstraction.

### Conclusion
Use **RxJS** when you need to handle complex time-based events (debounce, distinctUntilChanged, mergeMap).
Use **Quark** when you need fast, simple state storage with direct reactivity.

---

## 2. vs Signals (SolidJS, Preact, Vue)

Signals are the current trend in UI frameworks. They excel at fine-grained DOM updates.

### Dependency Tracking
*   **Signals:** They maintain a doubly-linked list of dependencies. When you read a signal, it checks a global context to see who is reading it and adds them to a graph. This has a computational cost (bookkeeping) on every read/write to ensure the graph is glitch-free.
*   **Quark:** It is "dumb". It does not track who reads it. It only notifies explicit listeners. This removes the overhead of graph maintenance. (Note: The `@alaq/nucl` layer adds tracking on top of Quark if needed, but Quark itself remains pure).

### The "Glitch" Problem
*   **Signals:** Spend significant CPU cycles ensuring "Diamond Problem" consistency (avoiding double updates in A->B->D, A->C->D graphs).
*   **Quark:** Follows a "Push" model. If you update A, B and C update immediately. Simpler, faster, but requires the developer (or the `Atom` orchestrator) to handle architecture.

### Conclusion
Use **Signals** for UI rendering where automatic fine-grained updates are critical.
Use **Quark** for the underlying business logic layer, game state, or high-frequency data (like mouse coordinates or websocket streams) where graph overhead is unwanted.

---

## 3. The "Quantum Bus" Difference

Neither Signals nor basic Observables provide a built-in architectural pattern for cross-module communication.

*   **Others:** You usually have to export a global variable or use React Context/Dependency Injection to share state.
*   **Quark:** Comes with **Realms**. A Quark can broadcast its changes to a named channel (`realm: 'auth'`). This allows completely decoupled modules to react to state changes without importing the state object itself.

## Summary

**Quark is not a replacement for RxJS or Signals in all cases.**

It is a **lower-level primitive** designed for:
1.  **Maximum Performance:** When every microsecond counts (Games, HFT, heavy Data Viz).
2.  **Memory constraints:** Creating 100,000 quarks is cheaper than 100,000 Observables.
3.  **Architecture:** When you need an Event-Driven State architecture via Realms.
