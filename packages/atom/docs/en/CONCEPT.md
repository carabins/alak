# Atom Concept: The State Orchestrator

This document explains the philosophy behind `@alaq/atom` — the most powerful tool in the Alaq ecosystem.

## 1. Why Atom?
If **Quark** and **Nucl** are the building blocks, **Atom** is the blueprint and the construction crew.

In complex applications, managing hundreds of individual variables is inconvenient. We need structure, typing, and automation. Atom allows you to use familiar TypeScript classes to describe complex state models while maintaining the extreme performance of the Alaq ecosystem.

## 2. Class as a Schema
In Atom, you describe data as a regular class. This gives you:
- **Out-of-the-box Typing**: IDEs understand your store's structure.
- **Encapsulation**: Logic (methods) and data (properties) live in one place.
- **Code Cleanliness**: You don't write `const a = Nu()`, `const b = Nu()`. You simply declare class fields.

```typescript
class TodoStore {
  items = []; // Automatically becomes a Nucl
  filter = 'all';

  add(text) {
    this.items = [...this.items, { text, done: false }];
  }
}
const todo = Atom(TodoStore);
```

## 3. The Magic of "Transparent" Reactivity
Atom uses modern JavaScript features (Proxies) to make reactivity invisible.
When you write `this.items = ...` inside a class method, Atom intercepts this action and updates the corresponding nucleon. You don't need to call functions manually or use special setters.

However, you can always "look under the hood": every field `name` has a "twin" `$name`, which is a full Nucl object.

## 4. Automatic Computations (Computed)
One of Atom's most powerful features is intelligent getters. Thanks to the Dependency Tracking system, any getter in a class automatically becomes reactive.

**How it works:**
1. When a getter is called for the first time, Atom "listens" to which model properties were read.
2. It creates a `fusion` between those properties and the getter's result.
3. Now the getter will only recalculate when its actual dependencies change.

## 5. Plugins and Conventions
Atom is designed to be extensible. Through the plugin system, you can implement any architectural pattern:
- Automatic synchronization with LocalStorage.
- Action logging.
- Integration with external data buses.

By default, Atom follows the "convention over configuration" principle, providing sensible behavior for most scenarios.

## Summary
- **Classes** are a convenient way to describe structure.
- **Proxies** make reactivity seamless.
- **$ prefix** provides access to low-level tools.
- **Computed** eliminates manual dependency management.
