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

    await expect(page.getByRole('heading', { name: 'Overall' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Wellbeing' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Growth' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Relationships' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Impact' })).toBeVisible();
  });

  test('should display sliders for each category', async ({ page }) => {
    const testUserId = generateTestUserId();
    await page.goto(`/${testUserId}`);

    // Look for MUI Slider components instead of input[type="range"]
    const sliders = page.locator('.MuiSlider-root');
    await expect(sliders).toHaveCount(5);
  });

  test('should have interactive sliders with auto-save', async ({ page }) => {
    const testUserId = generateTestUserId();
    await page.goto(`/${testUserId}`);

    // Wait for the page to finish loading and data fetching
    await page.waitForLoadState('networkidle');

    // Sliders should always be enabled (no save button needed with auto-save)
    const sliders = page.locator('.MuiSlider-root');
    await expect(sliders.first()).not.toHaveClass(/Mui-disabled/);

    // Should have 5 interactive sliders for all categories
    await expect(sliders).toHaveCount(5);
  });

});