# plugin-idb — Playwright smoke tests

These tests run `@alaq/plugin-idb` against **real** Chromium IndexedDB via
Playwright. Bun unit tests use an in-memory `fake-idb`; this harness exists
to find discrepancies between the fake and the real browser implementation.

## Layout

```
playwright/
  harness.html              loaded via file:// URL — no server
  harness.ts                window.__harness.* commands (bundled)
  bundle.js                 produced by build.ts (gitignored)
  build.ts                  Bun.build harness.ts → bundle.js
  playwright.config.ts      local config (does NOT reuse root config)
  smoke.e2e.ts              the tests (.e2e suffix keeps it out of bun test's default glob)
```

## Running

From repo root:

```bash
bun packages/plugin-idb/playwright/build.ts
bunx playwright test --config=packages/plugin-idb/playwright/playwright.config.ts
```

Or, once inside `packages/plugin-idb`:

```bash
bun run test:browser
```

If Chromium isn't installed yet: `bunx playwright install chromium`.

## Why file:// and not a server?

The harness is a single static HTML page with a single bundled script.
Chromium respects IndexedDB per-origin, and `file://` works fine for that.
Avoiding a dev server keeps the setup footprint tiny.

## Adding a new test

1. Add a command to `harness.ts` (under `window.__harness`).
2. Rebuild: `bun playwright/build.ts`.
3. Add a `test(...)` block to `smoke.test.ts` that drives it via `page.evaluate`.

Use `clearIdb()` at the start of each test for isolation — we don't rely
on Playwright contexts for isolation because we want to inspect persistence
across `page.reload()`.
