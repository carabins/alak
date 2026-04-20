/**
 * Playwright smoke tests for @alaq/plugin-idb against REAL Chromium IndexedDB.
 *
 * Strategy:
 *   - beforeAll: Playwright launches a chromium context; we serve harness.html
 *     via a `file://` URL loaded from disk.
 *   - Each test calls `window.__harness.*` via page.evaluate.
 *   - beforeEach: clearIdb() wipes the database cleanly.
 *
 * Intent: find where fake-idb lies. Real IDB has structured-clone, real
 * transactional semantics, real quota, real async scheduling.
 */

import { test, expect, chromium, type Browser, type Page } from '@playwright/test'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const HARNESS_URL = pathToFileURL(resolve(__dirname, 'harness.html')).href

let browser: Browser
let page: Page

test.beforeAll(async () => {
  browser = await chromium.launch({ headless: !process.env.PWDEBUG })
})

test.afterAll(async () => {
  await browser.close()
})

test.beforeEach(async () => {
  // Fresh context each test so IDB is per-origin but isolated between tests.
  const ctx = await browser.newContext()
  page = await ctx.newPage()
  page.on('pageerror', (err) => console.log('[page error]', err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('[console.error]', msg.text())
  })
  await page.goto(HARNESS_URL)
  await page.waitForFunction(() => (window as any).__harnessReady === true, null, {
    timeout: 5000,
  })
})

test.afterEach(async () => {
  await page.context().close()
})

// --------------------------------------------------------------------------

test('Test 1: KV save + real reload + restore', async () => {
  // Clean slate
  await page.evaluate(() => (window as any).__harness.clearIdb('app'))

  // Create and wait for ready
  await page.evaluate(() =>
    (window as any).__harness.createKv('user.settings', { theme: 'dark' }),
  )
  const ready1 = await page.evaluate(() =>
    (window as any).__harness.waitFor('user.settings', 'ready', true),
  )
  expect(ready1).toBe(true)

  // Mutate and wait for $saved flip
  await page.evaluate(() =>
    (window as any).__harness.set('user.settings', { theme: 'light' }),
  )
  const saved = await page.evaluate(() =>
    (window as any).__harness.waitFor('user.settings', 'saved', true),
  )
  expect(saved).toBe(true)

  // Confirm it's actually on disk via a raw IDB read (bypassing plugin)
  const raw = await page.evaluate(() =>
    (window as any).__harness.rawKvGet('user.settings', 'app'),
  )
  expect(raw).toEqual({ hit: true, value: { theme: 'light' } })

  // REAL page reload — this is the critical part
  await page.reload()
  await page.waitForFunction(() => (window as any).__harnessReady === true, null, {
    timeout: 5000,
  })

  // Recreate with SAME default; if rehydrate works, we get 'light' back
  await page.evaluate(() =>
    (window as any).__harness.createKv('user.settings', { theme: 'dark' }),
  )
  const ready2 = await page.evaluate(() =>
    (window as any).__harness.waitFor('user.settings', 'ready', true),
  )
  expect(ready2).toBe(true)

  const value = await page.evaluate(() =>
    (window as any).__harness.get('user.settings'),
  )
  expect(value).toEqual({ theme: 'light' })
})

// --------------------------------------------------------------------------

test('Test 2: Collection insert + query + reload + restore', async () => {
  await page.evaluate(() => (window as any).__harness.clearIdb('app'))

  await page.evaluate(() =>
    (window as any).__harness.createCollection('app.todos', 'id', ['done']),
  )
  const ready = await page.evaluate(() =>
    (window as any).__harness.waitFor('app.todos', 'ready', true),
  )
  expect(ready).toBe(true)

  await page.evaluate(() => {
    const h = (window as any).__harness
    h.insert('app.todos', { id: '1', title: 'a', done: false })
    h.insert('app.todos', { id: '2', title: 'b', done: true })
    h.insert('app.todos', { id: '3', title: 'c', done: false })
  })

  const saved = await page.evaluate(() =>
    (window as any).__harness.waitFor('app.todos', 'saved', true),
  )
  expect(saved).toBe(true)

  const all = await page.evaluate(() => (window as any).__harness.query('app.todos'))
  expect(all).toHaveLength(3)

  const openTodos = await page.evaluate(() =>
    (window as any).__harness.query('app.todos', { where: 'done', equals: false }),
  )
  expect(openTodos).toHaveLength(2)

  // Reload
  await page.reload()
  await page.waitForFunction(() => (window as any).__harnessReady === true, null, {
    timeout: 5000,
  })

  await page.evaluate(() =>
    (window as any).__harness.createCollection('app.todos', 'id', ['done']),
  )
  const ready2 = await page.evaluate(() =>
    (window as any).__harness.waitFor('app.todos', 'ready', true),
  )
  expect(ready2).toBe(true)

  const restored = await page.evaluate(() => (window as any).__harness.get('app.todos'))
  expect(restored).toHaveLength(3)
  const ids = (restored as any[]).map((r) => r.id).sort()
  expect(ids).toEqual(['1', '2', '3'])
})

// --------------------------------------------------------------------------

test('Test 3: Rapid writes debounce to final value', async () => {
  await page.evaluate(() => (window as any).__harness.clearIdb('app'))

  await page.evaluate(() =>
    (window as any).__harness.createKv('counter', 0, 'app', 30),
  )
  await page.evaluate(() =>
    (window as any).__harness.waitFor('counter', 'ready', true),
  )

  await page.evaluate(() => {
    const h = (window as any).__harness
    h.set('counter', 1)
    h.set('counter', 2)
    h.set('counter', 3)
  })

  // Wait for debounce to expire, then for saved to flip true
  const saved = await page.evaluate(() =>
    (window as any).__harness.waitFor('counter', 'saved', true),
  )
  expect(saved).toBe(true)

  // Verify only final value persisted — raw IDB read
  const raw = await page.evaluate(() => (window as any).__harness.rawKvGet('counter'))
  expect(raw).toEqual({ hit: true, value: 3 })

  // Reload + restore
  await page.reload()
  await page.waitForFunction(() => (window as any).__harnessReady === true)
  await page.evaluate(() => (window as any).__harness.createKv('counter', 0))
  await page.evaluate(() => (window as any).__harness.waitFor('counter', 'ready', true))
  const v = await page.evaluate(() => (window as any).__harness.get('counter'))
  expect(v).toBe(3)
})

// --------------------------------------------------------------------------

test('Test 4: DataCloneError on non-serializable value (functions)', async () => {
  await page.evaluate(() => (window as any).__harness.clearIdb('app'))
  await page.evaluate(() => (window as any).__harness.clearLastError())

  await page.evaluate(() => (window as any).__harness.createKv('bad', null))
  await page.evaluate(() => (window as any).__harness.waitFor('bad', 'ready', true))

  // Functions cannot be structured-cloned — real IDB must reject.
  // fake-idb in contrast just stores the value in a Map without any cloning,
  // so this test exposes a real-vs-fake divergence.
  await page.evaluate(() => {
    const h = (window as any).__harness
    h.set('bad', { fn: () => 'hi', nested: { n: 1 } })
  })

  // Allow debounce + flush + error bubbling
  await page.evaluate(() => (window as any).__harness.sleep(200))

  // Observations we collect for the report:
  const saved = await page.evaluate(() => (window as any).__harness.saved('bad'))
  const lastError = await page.evaluate(() =>
    (window as any).__harness.getLastError(),
  )
  const raw = await page.evaluate(() => (window as any).__harness.rawKvGet('bad'))
  const inMemory = await page.evaluate(() => {
    const v = (window as any).__harness.get('bad')
    // Functions aren't JSON-serializable; describe what we see.
    return {
      hasFn: typeof v?.fn === 'function',
      nested: v?.nested,
    }
  })

  // Observed real-IDB behaviour (documented, not hypothetical):
  //   - kvPut() rejects with DataCloneError
  //   - plugin.flushKv catches, logs, and ROLLS BACK in-memory to lastSaved (null)
  //   - $saved stays false (plugin leaves the error state observable)
  //   - nothing lands on disk
  //
  // This is a MATERIAL divergence from fake-idb: fake-idb's wrapStore.put()
  // just does `store.records.set(k, value)` on a plain Map — it happily
  // stores functions. Any bug in plugin's error path would be invisible in
  // bun tests. Here we assert the observed reality.
  expect(saved).toBe(false)           // write failed, $saved remains false
  expect(raw.hit).toBe(false)         // nothing persisted
  expect(inMemory.hasFn).toBe(false)  // rollback wiped the function from memory
  // lastError === null means the rejection is swallowed inside the plugin
  // (not surfaced to the page as an unhandled rejection). That's arguably
  // correct — the plugin logs it via logIdb — but worth noting for the report.
  console.log('[Test 4] saved=', saved, 'raw=', raw, 'lastError=', lastError)
  console.log('[Test 4] inMemory after rollback=', inMemory)
})

// --------------------------------------------------------------------------

test('Test 5: Default value NOT overwritten on miss (no spurious write)', async () => {
  // Regression: the plugin's skipNextOnBeforeChange should prevent the
  // default value from being persisted. If a KV nucl is created with a
  // default and never mutated, the DB should NOT have an entry for it.
  //
  // This was a subtle bug class hidden by fake-idb: if the plugin wrongly
  // persisted the default, fake-idb would accept it silently and the
  // "default value" tests would still pass because the default matches.
  // In real IDB we verify by reading the raw store.
  await page.evaluate(() => (window as any).__harness.clearIdb('app'))

  await page.evaluate(() =>
    (window as any).__harness.createKv('defaulted', { v: 'initial' }),
  )
  await page.evaluate(() =>
    (window as any).__harness.waitFor('defaulted', 'ready', true),
  )

  // Wait well past any debounce window
  await page.evaluate(() => (window as any).__harness.sleep(80))

  const raw = await page.evaluate(() =>
    (window as any).__harness.rawKvGet('defaulted'),
  )
  const saved = await page.evaluate(() =>
    (window as any).__harness.saved('defaulted'),
  )

  // If plugin behaves correctly: no row on disk, $saved stays true
  // (never went false because no write was attempted).
  expect(saved).toBe(true)
  expect(raw.hit).toBe(false)
})
