import { defineConfig } from '@playwright/test'

/**
 * Local Playwright config for plugin-idb smoke tests.
 *
 * Does NOT reuse the root playwright.config.ts (which boots a dev server
 * for __new_hat). Here we just open harness.html via file:// URL — no
 * web server required.
 */
export default defineConfig({
  testDir: '.',
  testMatch: /smoke\.e2e\.ts$/,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  timeout: 20_000,
  use: {
    trace: 'on-first-retry',
  },
})
