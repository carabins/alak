# StateX: The Bridge Between Logic and Reactivity

While **Quark** stores raw data and **Nucl** adds behavior through plugins, **StateX** connects your application's business logic (state machines) to the reactive world.

If Quark is raw data, Nucl is managed data — StateX is the **orchestrator**.

## 1. Why do we need StateX?

State machines are excellent at modeling complex application flows:
- **Explicit States**: "loading", "playing", "error" — never invalid combinations
- **Guarded Transitions**: Can only go from A to B if condition X is met
- **Visual Design**: Design in [Stately.ai](https://stately.ai/viz), export to code
- **Predictability**: Every possible state and transition is documented

But state machines alone don't integrate well with reactive UIs:
- How do you bind machine state to a component?
- How do you trigger effects when entering a state?
- How do you combine machine state with other reactive data?

StateX solves this by wrapping XState machines in Alak primitives.

## 2. The Brain/Body Metaphor

| Concept | XState (Brain) | Alak (Body) |
|---------|----------------|-------------|
| **Focus** | What CAN happen | How data FLOWS |
| **Strength** | Explicit transitions | Reactive effects |
| **Tooling** | Visual editor | Fluent API |

StateX connects these two worlds:

```typescript
const heater = fromMachine(heaterMachine)

// Brain: XState handles state logic
heater.send({ type: 'TOGGLE' }) // Transition from inactive -> active

// Body: Alak handles reactivity
heater.state().up(s => updateUI(s))        // Subscribe to state changes
heater.state('active').up(a => toggle(a))  // Reactive state matcher
```

## 3. Reactive Adapter Pattern

`fromMachine()` creates an adapter that exposes XState internals as Alak primitives:

```
XState Machine
     │
     ▼
┌─────────────────────────────────────────┐
│          fromMachine()                  │
├─────────────────────────────────────────┤
│  .actor        → Raw XState Actor       │
│  .state()      → Quark<StateValue>      │
│  .state('x')   → Quark<boolean>         │  ← Matcher
│  .ctx()        → Quark<Context>         │
│  .ctx('path')  → Quark<T>               │  ← Selector
│  .ctx(fn)      → Quark<T>               │  ← Computed
│  .can('EVENT') → Quark<boolean>         │
│  .action()     → Quark<Action>          │  ← Action stream
│  .toEvent()                             │  ← Input binding
│  .asEvent()                             │  ← Input binding
│  .send()                                │  ← Dispatch events
│  .decay()                               │  ← Cleanup everything
└─────────────────────────────────────────┘
```

Every output is a reactive Quark that integrates seamlessly with `fx` and UI frameworks.

## 4. Input Bindings

StateX provides two ways to connect external reactive sources to the machine:

### `.toEvent()` — Field Binding

```typescript
const sensor = Qv(20)

// When sensor changes -> send { type: 'SENSOR_UPDATE', temp: value }
heater.toEvent(sensor, 'SENSOR_UPDATE', 'temp')

sensor(25) // Automatically triggers state transition
```

### `.asEvent()` — Full Event Binding

```typescript
const control = Qv<any>(undefined)

heater.asEvent(control)

control({ type: 'TOGGLE' }) // Sends event directly
```

## 5. Action Stream

StateX captures executed actions via XState's inspect API:

```typescript
// Listen for specific action
heater.action('notifyUser').up(() => {
  showNotification('Heater is now heating!')
})

// Listen for all actions
heater.action().up(action => {
  console.log('Action executed:', action.type)
})
```

## Summary

- **XState** = Business logic, explicit states, visual design.
- **StateX** = Adapter that makes XState reactive.
- **Alak** = Reactive primitives, effects, UI binding.
- **Together** = Design logic visually, bind reactively, manage effects declaratively.
