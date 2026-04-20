import { describe, expect, test, beforeEach } from 'bun:test'
import { createNu } from '@alaq/nucl/createNu'
import { idbPlugin, __resetIdbRuntime } from '../src/plugin'
import { createFakeIDB, __resetFakeIDB } from '../src/mock/fake-idb'

async function settle(ms = 150): Promise<void> {
  await new Promise(r => setTimeout(r, ms))
}

interface Todo { id: string; title: string; done: boolean; dueDate?: string }

beforeEach(() => {
  __resetIdbRuntime()
  __resetFakeIDB()
})

describe('idbPlugin — collection mode', () => {
  test('insert updates in-memory array synchronously', async () => {
    const factory = createFakeIDB()
    const plugin = idbPlugin({ factory, debounceMs: 20 })

    const todos: any = createNu<Todo[]>({
      realm: 'app', id: 'app.todos',
      value: [] as Todo[],
      collection: { primaryKey: 'id', indexes: ['done'] },
      plugins: [plugin],
    } as any)

    await settle(40)
    expect(todos.$ready.value).toBe(true)

    todos.insert({ id: '1', title: 'buy milk', done: false })
    expect(todos._value.length).toBe(1)
    expect(todos._value[0].title).toBe('buy milk')
    expect(todos.$saved.value).toBe(false)

    await settle(60)
    expect(todos.$saved.value).toBe(true)
  })

  test('insert upserts by primaryKey (no duplicate)', async () => {
    const factory = createFakeIDB()
    const plugin = idbPlugin({ factory, debounceMs: 20 })

    const todos: any = createNu<Todo[]>({
      realm: 'app', id: 'app.todos',
      value: [] as Todo[],
      collection: { primaryKey: 'id' },
      plugins: [plugin],
    } as any)
    await settle(40)

    todos.insert({ id: '1', title: 'a', done: false })
    todos.insert({ id: '1', title: 'a-updated', done: true })
    expect(todos._value.length).toBe(1)
    expect(todos._value[0].title).toBe('a-updated')
    expect(todos._value[0].done).toBe(true)
  })

  test('update patches existing record', async () => {
    const factory = createFakeIDB()
    const plugin = idbPlugin({ factory, debounceMs: 20 })

    const todos: any = createNu<Todo[]>({
      realm: 'app', id: 'app.todos',
      value: [] as Todo[],
      collection: { primaryKey: 'id' },
      plugins: [plugin],
    } as any)
    await settle(40)

    todos.insert({ id: '1', title: 'a', done: false })
    todos.update('1', { done: true })
    expect(todos._value[0].done).toBe(true)
    expect(todos._value[0].title).toBe('a')  // patched, not replaced
  })

  test('remove deletes by primaryKey', async () => {
    const factory = createFakeIDB()
    const plugin = idbPlugin({ factory, debounceMs: 20 })

    const todos: any = createNu<Todo[]>({
      realm: 'app', id: 'app.todos',
      value: [] as Todo[],
      collection: { primaryKey: 'id' },
      plugins: [plugin],
    } as any)
    await settle(40)

    todos.insert({ id: '1', title: 'a', done: false })
    todos.insert({ id: '2', title: 'b', done: false })
    todos.remove('1')

    expect(todos._value.length).toBe(1)
    expect(todos._value[0].id).toBe('2')
  })

  test('query filters by where/equals on in-memory array', async () => {
    const factory = createFakeIDB()
    const plugin = idbPlugin({ factory, debounceMs: 20 })

    const todos: any = createNu<Todo[]>({
      realm: 'app', id: 'app.todos',
      value: [] as Todo[],
      collection: { primaryKey: 'id', indexes: ['done'] },
      plugins: [plugin],
    } as any)
    await settle(40)

    todos.insert({ id: '1', title: 'a', done: false })
    todos.insert({ id: '2', title: 'b', done: true })
    todos.insert({ id: '3', title: 'c', done: false })

    const open = todos.query({ where: 'done', equals: false })
    expect(open.length).toBe(2)
    const done = todos.query({ where: 'done', equals: true })
    expect(done.length).toBe(1)
    expect(done[0].id).toBe('2')

    // no-arg → full snapshot
    const all = todos.query()
    expect(all.length).toBe(3)
  })

  test('rehydrates collection across sessions', async () => {
    const factory = createFakeIDB()

    {
      const plugin = idbPlugin({ factory, debounceMs: 20 })
      const todos: any = createNu<Todo[]>({
        realm: 'app', id: 'app.todos',
        value: [] as Todo[],
        collection: { primaryKey: 'id' },
        plugins: [plugin],
      } as any)
      await settle(40)
      todos.insert({ id: '1', title: 'a', done: false })
      todos.insert({ id: '2', title: 'b', done: false })
      await settle(60)
      expect(todos.$saved.value).toBe(true)
    }

    __resetIdbRuntime()
    const plugin2 = idbPlugin({ factory, debounceMs: 20 })
    const todos2: any = createNu<Todo[]>({
      realm: 'app', id: 'app.todos',
      value: [] as Todo[],
      collection: { primaryKey: 'id' },
      plugins: [plugin2],
    } as any)

    await settle(60)
    expect(todos2.$ready.value).toBe(true)
    expect(todos2._value.length).toBe(2)
    const ids = todos2._value.map((t: Todo) => t.id).sort()
    expect(ids).toEqual(['1', '2'])
  })

  test('remove followed by new insert with same key — final state has the insert', async () => {
    const factory = createFakeIDB()
    const plugin = idbPlugin({ factory, debounceMs: 20 })

    const todos: any = createNu<Todo[]>({
      realm: 'app', id: 'app.todos',
      value: [] as Todo[],
      collection: { primaryKey: 'id' },
      plugins: [plugin],
    } as any)
    await settle(40)

    todos.insert({ id: '1', title: 'a', done: false })
    await settle(60)
    todos.remove('1')
    todos.insert({ id: '1', title: 'b', done: true })
    await settle(60)

    expect(todos._value.length).toBe(1)
    expect(todos._value[0].title).toBe('b')
  })

  test('update on missing key is a noop', async () => {
    const factory = createFakeIDB()
    const plugin = idbPlugin({ factory, debounceMs: 20 })

    const todos: any = createNu<Todo[]>({
      realm: 'app', id: 'app.todos',
      value: [] as Todo[],
      collection: { primaryKey: 'id' },
      plugins: [plugin],
    } as any)
    await settle(40)

    todos.update('nonexistent', { done: true })
    expect(todos._value.length).toBe(0)
  })

  test('insert without primary key throws', async () => {
    const factory = createFakeIDB()
    const plugin = idbPlugin({ factory, debounceMs: 20 })

    const todos: any = createNu<Todo[]>({
      realm: 'app', id: 'app.todos',
      value: [] as Todo[],
      collection: { primaryKey: 'id' },
      plugins: [plugin],
    } as any)
    await settle(40)

    expect(() => todos.insert({ title: 'no id', done: false } as any))
      .toThrow(/primaryKey/)
  })
})
