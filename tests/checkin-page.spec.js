import { test, expect } from '@playwright/test';

test.describe('Checkin Page', () => {
  // Use unique user IDs for each test to avoid conflicts
  const generateTestUserId = () => `test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('should display all five checkin categories', async ({ page }) => {
    const testUserId = generateTestUserId();
    await page.goto(`/${testUserId}`);

    await expect(page.getByText('Overall')).toBeVisible();
    await expect(page.getByText('Wellbeing')).toBeVisible();
    await expect(page.getByText('Growth')).toBeVisible();
    await expect(page.getByText('Relationships')).toBeVisible();
    await expect(page.getByText('Impact')).toBeVisible();
  });

  test('should display sliders for each category', async ({ page }) => {
    const testUserId = generateTestUserId();
    await page.goto(`/${testUserId}`);

    const sliders = page.locator('input[type="range"]');
    await expect(sliders).toHaveCount(5);
  });

  test('should show Add Check-in button for new user', async ({ page }) => {
    const testUserId = generateTestUserId();
    await page.goto(`/${testUserId}`);

    // For a new user with no data, should show "Add Check-in" button
    await expect(page.getByText('Add Check-in')).toBeVisible();

    // Sliders should be disabled for new user
    const sliders = page.locator('input[type="range"]');
    await expect(sliders.first()).toBeDisabled();
  });

});