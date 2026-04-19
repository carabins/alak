import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './__new_hat/test/e2e', // Point to demo tests
  webServer: {
    command: 'cd __new_hat/client && bun run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
  use: {
    baseURL: 'http://localhost:3000',
  },
});