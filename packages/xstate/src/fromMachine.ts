import {
  createActor,
  type AnyStateMachine,
  type ActorOptions,
  type EventFrom,
  type ContextFrom,
  type StateValueFrom,
  type Subscription,
  type Actor,
  type SnapshotFrom,
  type InspectionEvent
} from 'xstate'

import { Qv, type IQuark } from '@alaq/quark'
import { Nv, type INuOptions } from '@alaq/nucl'
import { getPath } from './utils'

export interface AdapterOptions {
  /**
   * Reactive primitive to use.
   * 'quark' - Lightweight, faster (default).
   * 'nucl' - Supports plugins (persistence, deep-observing).
   */
  primitive?: 'quark' | 'nucl'
  
  /** Options passed to Nv() if primitive is 'nucl' */
  nuclOptions?: INuOptions

  /** Auto-start the actor (default: true) */
  autoStart?: boolean
  
  /** Initial input/context override */
  input?: any
}

export interface MachineAdapter<TMachine extends AnyStateMachine> {
  /** Raw XState Actor instance */
  actor: Actor<TMachine>

  // --- Outputs ---

  /**
   * Get reactive state value or boolean matcher.
   * @example state() -> 'idle'
   * @example state('active') -> true
   */
  state(matches?: string): IQuark<any>

  /**
   * Get reactive context (full or selected).
   * @example ctx() -> full context object
   * @example ctx('user.name') -> string
   * @example ctx(c => c.count * 2) -> number
   */
  ctx<T = any>(selector?: string | ((context: ContextFrom<TMachine>) => T)): IQuark<T>

  /**
   * Check if an event can be sent in current state.
   * @example can('NEXT') -> true
   */
  can(eventType: EventFrom<TMachine>['type']): IQuark<boolean>

  /**
   * Stream of executed actions.
   * @param type Optional action type to filter by
   */
  action(type?: string): IQuark<any>

  // --- Inputs ---

  /**
   * Bind quark value to event field.
   * @param quark Source quark
   * @param eventType Event type to send
   * @param key Payload key (default: 'value')
   */
  toEvent<T>(quark: IQuark<T>, eventType: string, key?: string): void

  /**
   * Bind quark value as event object.
   * @param quark Source quark
   * @param eventType Optional event type to merge
   */
  asEvent<T extends object>(quark: IQuark<T>, eventType?: string): void

  // --- Control ---

  send(event: EventFrom<TMachine>): void
  start(): void
  stop(): void
  decay(): void
}

export function fromMachine<TMachine extends AnyStateMachine>(
  machine: TMachine,
  options: AdapterOptions & ActorOptions<TMachine> = {}
): MachineAdapter<TMachine> {
  
  const { 
    autoStart = true, 
    primitive = 'quark', 
    nuclOptions,
    input, 
    ...actorOpts 
  } = options

  // --- Factory for Primitives ---
  const createQ = <T>(val: T, opts: any = {}): IQuark<T> => {
    if (primitive === 'nucl') {
      return Nv(val, { ...nuclOptions, ...opts })
    }
    return Qv(val, opts)
  }

  // --- Disposables Tracking ---
  const disposables: Array<() => void> = []

  // --- Action Stream Setup ---
  const actionStream$ = createQ<any>(undefined, { stateless: true })
  
  // We use inspect to capture actions
  const inspectListener = (event: InspectionEvent) => {
    if (event.type === '@xstate.action') {
      actionStream$(event.action)
    }
  }

  // --- Actor Initialization ---
  const actor = createActor(machine, {
    ...actorOpts,
    input,
    inspect: inspectListener
  }) as Actor<TMachine>

  // --- State & Context Containers ---
  const snapshot = actor.getSnapshot() as any
  
  const state$ = createQ(snapshot.value)
  const context$ = createQ(snapshot.context)
  
  // --- Subscription ---
  const sub = actor.subscribe((s: any) => {
    state$(s.value)
    context$(s.context)
  })

  if (autoStart) {
    actor.start()
  }

  return {
    actor,

    state(matches?: string) {
      if (!matches) return state$

      const matcher = createQ(false)
      
      const check = () => {
        const snap = actor.getSnapshot() as any
        if (snap) {
          matcher(snap.matches(matches))
        }
      }

      state$.up(check)
      check()

      return matcher
    },

    ctx(selector?: string | ((c: ContextFrom<TMachine>) => any)) {
      if (!selector) return context$

      let compute: (ctx: any) => any

      if (typeof selector === 'function') {
        compute = selector
      } else {
        compute = (ctx) => getPath(ctx, selector)
      }

      const derived = createQ(compute(context$.value))

      context$.up((ctx) => {
        derived(compute(ctx))
      })

      return derived
    },

    can(eventType) {
      const checker = createQ(false)
      
      const check = () => {
        const snap = actor.getSnapshot() as any
        if (snap) {
          checker(snap.can({ type: eventType } as any))
        }
      }

      state$.up(check)
      check()

      return checker
    },

    action(type?: string) {
      if (!type) return actionStream$
      
      const filtered = createQ(undefined, { stateless: true })
      actionStream$.up((a) => {
         if (a && a.type === type) {
           filtered(a)
         }
      })
      return filtered
    },

    toEvent(quark, eventType, key = 'value') {
      disposables.push(quark.up((val) => {
        if (val !== undefined && val !== null) {
          actor.send({ type: eventType, [key]: val } as any)
        }
      }))
    },

    asEvent(quark, eventType) {
      disposables.push(quark.up((val: any) => {
        if (!val) return

        if (eventType) {
          actor.send({ type: eventType, ...val })
        } else {
          actor.send(val)
        }
      }))
    },

    send(event) {
      actor.send(event)
    },

    start() {
      actor.start()
    },

    stop() {
      actor.stop()
    },

    decay() {
      sub.unsubscribe()
      actor.stop()
      
      // Stop internal reactivity
      state$.decay()
      context$.decay()
      actionStream$.decay()
      
      // Stop external bindings
      disposables.forEach(d => d())
      disposables.length = 0
    }
  }
}
