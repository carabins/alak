import { test, expect } from '@playwright/test';

test('renders vgroup correctly', async ({ page }) => {
  // Go to localhost (configured in playwright.config.ts)
  await page.goto('/');
  
  await page.waitForFunction(() => (window as any).isReady);
  
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
});