import { describe, it, expect } from 'bun:test'
import { effectScope, defineComponent, h, createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { SyncStore } from '@alaq/link-state'
import {
  useNode,
  useNodeWithDefault,
  toRefNoScope,
  provideStore,
  useStore,
  SYNC_STORE_KEY,
} from '../src'

// ───────────────────────────────────────────────────────────────
// useNode — basic reactivity
// ───────────────────────────────────────────────────────────────

describe('useNode — basics', () => {
  it('1. updates the ref when the underlying SyncNode changes', () => {
    const store = new SyncStore()
    store.applyPatch('player', { hp: 100 })
    const player = store.get<{ hp: number }>('player')

    const scope = effectScope()
    let playerRef!: ReturnType<typeof useNode<{ hp: number }>>
    scope.run(() => {
      playerRef = useNode(player)
    })

    expect(playerRef.value?.hp).toBe(100)

    store.applyPatch('player', { hp: 42 })
    expect(playerRef.value?.hp).toBe(42)

    scope.stop()
  })

  it('2. unsubscribes on scope dispose — useNode listener removed from store', () => {
    // We can't compare ref values before/after because deep-state proxies share
    // identity across updates (mutating the proxy contents affects all holders).
    // Instead, we assert at the transport level: useNode registered exactly one
    // store listener and releases it when the scope is disposed.
    const store = new SyncStore()
    store.applyPatch('counter', 1)
    const counter = store.get<number>('counter')

    const beforeScope = (store as any)._listeners.get('counter')?.size ?? 0

    const scope = effectScope()
    scope.run(() => {
      useNode(counter)
    })

    const duringScope = (store as any)._listeners.get('counter')?.size ?? 0
    expect(duringScope).toBe(beforeScope + 1)

    scope.stop()

    const afterScope = (store as any)._listeners.get('counter')?.size ?? 0
    expect(afterScope).toBe(beforeScope)
  })

  it('3. throws when called outside a Vue scope', () => {
    const store = new SyncStore()
    const player = store.get('player')

    expect(() => useNode(player)).toThrow(/outside a Vue component/)
  })
})

// ───────────────────────────────────────────────────────────────
// useNodeWithDefault — ghost fallback
// ───────────────────────────────────────────────────────────────

describe('useNodeWithDefault', () => {
  it('4. returns defaultValue while the node is ghost/pending', () => {
    const store = new SyncStore()
    const hp = store.get<number>('player.hp')

    expect(hp.$meta.isGhost).toBe(true)

    const scope = effectScope()
    let hpRef!: ReturnType<typeof useNodeWithDefault<number>>
    scope.run(() => {
      hpRef = useNodeWithDefault(hp, 100)
    })

    expect(hpRef.value).toBe(100)

    store.applyPatch('player', { hp: 42 })
    expect(hpRef.value).toBe(42)

    scope.stop()
  })
})

// ───────────────────────────────────────────────────────────────
// toRefNoScope — manual lifecycle outside Vue
// ───────────────────────────────────────────────────────────────

describe('toRefNoScope', () => {
  it('5. works without a Vue scope; release() stops updates', () => {
    const store = new SyncStore()
    store.applyPatch('x', 1)
    const xNode = store.get<number>('x')

    const { ref: r, release } = toRefNoScope(xNode)
    expect(r.value).toBe(1)

    store.applyPatch('x', 2)
    expect(r.value).toBe(2)

    release()
    store.applyPatch('x', 3)
    expect(r.value).toBe(2) // unchanged
  })
})

// ───────────────────────────────────────────────────────────────
// provideStore / useStore — DI
// ───────────────────────────────────────────────────────────────

describe('provideStore / useStore', () => {
  it('6. injects the same store instance in a child component', async () => {
    const store = new SyncStore()
    let resolved: any = null

    const Child = defineComponent({
      setup() {
        resolved = useStore()
        return () => h('span', 'child')
      },
    })

    const Root = defineComponent({
      setup() {
        provideStore(store)
        return () => h(Child)
      },
    })

    const app = createSSRApp(Root)
    await renderToString(app)

    expect(resolved).toBe(store)
  })

  it('7. throws when useStore() is called without a provider', async () => {
    let threw: any = null

    const Orphan = defineComponent({
      setup() {
        try {
          useStore()
        } catch (e: any) {
          threw = e
        }
        return () => h('span', 'ok')
      },
    })

    const app = createSSRApp(Orphan)
    await renderToString(app)

    expect(threw).toBeInstanceOf(Error)
    expect(String(threw.message)).toMatch(/No SyncStore provided/)
  })

  it('8. SYNC_STORE_KEY is a symbol and exported for advanced use', () => {
    expect(typeof SYNC_STORE_KEY).toBe('symbol')
  })
})
