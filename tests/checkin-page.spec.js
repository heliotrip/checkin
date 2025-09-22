import { test, expect } from '@playwright/test';

test.describe('Checkin Page', () => {
  const testUserId = '12345678-1234-1234-1234-123456789abc';

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto(`/${testUserId}`);
  });

  test('should display all five checkin categories', async ({ page }) => {
    await expect(page.getByText('Overall')).toBeVisible();
    await expect(page.getByText('Wellbeing')).toBeVisible();
    await expect(page.getByText('Growth')).toBeVisible();
    await expect(page.getByText('Relationships')).toBeVisible();
    await expect(page.getByText('Impact')).toBeVisible();
  });

  test('should display sliders for each category', async ({ page }) => {
    const sliders = page.locator('input[type="range"]');
    await expect(sliders).toHaveCount(5);
  });
});