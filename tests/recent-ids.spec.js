import { test, expect } from '@playwright/test';

test.describe('Recent IDs Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('should not show Recent IDs section when no IDs have been visited', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Recent IDs')).not.toBeVisible();
  });
});