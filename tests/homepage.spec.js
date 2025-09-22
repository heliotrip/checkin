import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('should display the main page correctly', async ({ page }) => {
    await page.goto('/');

    // Check main heading
    await expect(page.locator('h1')).toContainText('Checkin');

    // Check both main action cards
    await expect(page.getByText('Create New ID')).toBeVisible();
    await expect(page.getByText('Access Existing ID')).toBeVisible();
  });
});