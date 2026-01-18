# @alaq/deep-state Roadmap: Ghost Proxies

## Goal
Implement a "Ghost Proxy" mode to support lazy-loading and network-replicated state without causing `undefined` errors in the UI.

## Core Feature: Ghosting
When a user accesses a property that is currently `undefined` on a deep-state proxy, the system should not return `undefined`. Instead, it should:
1.  Return a special, temporary "Ghost Proxy".
2.  Emit an event indicating that a "ghost" property was accessed.

## Technical Implementation Plan

1.  **Extend `createState` Options:**
    *   Add `ghost: boolean` (default: `false`) to enable the mode.
    *   Add `onGhost: (path: string) => void`, a callback that will be triggered when a ghost is created.

2.  **Modify `baseHandler.get`:**
    *   In the `get` trap, if `target[key]` is `undefined` and `root.ghosts` is `true`:
        *   Trigger `root.onGhost(currentPath + '.' + key)`.
        *   Return a new "Ghost Proxy" that knows its own path.

3.  **Create `ghostHandler`:**
    *   This is a separate, lightweight proxy handler for ghost objects.
    *   **`get` trap:** Always returns another Ghost Proxy for any property access, recursively building the path.
    *   **Other traps (`valueOf`, `toString`):** Return `undefined` or an empty representation to prevent crashes when used in templates.

## Performance Considerations
- The check for ghosting (`if (value === undefined && root.ghosts)`) is extremely cheap and will have **zero impact** on performance when the feature is disabled.
- The cost is only incurred for data that is not yet present, which is the intended use case.

## Use Case
This feature is the foundational building block for `@alaq/link-state`, enabling it to build a reactive, lazy-loading cache of the server's state.
