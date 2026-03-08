import { test, expect } from '@playwright/test';

/**
 * E2E — Settings Page
 *
 * Validates that the settings dashboard renders correctly
 * and allows basic interactions.
 */

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('main')).toBeVisible();
  });

  test('should render the settings page', async ({ page }) => {
    await expect(page).toHaveURL('/settings');
    await expect(page.locator('main')).toBeVisible();
  });

  test('should show settings dashboard content', async ({ page }) => {
    // Settings dashboard renders section headers or form controls
    const main = page.locator('main');
    await expect(main).not.toBeEmpty();
  });

  test('should not display JS errors on settings page', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/settings');
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(e =>
      !e.includes('network') && !e.includes('fetch') && !e.includes('CORS')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('settings page should have sidebar with navigation', async ({ page }) => {
    // Settings page uses the same Sidebar layout
    await expect(page.getByRole('link', { name: /mapa/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /analytics/i })).toBeVisible();
  });

  test('should navigate from settings back to home', async ({ page }) => {
    await page.getByRole('link', { name: /mapa/i }).click();
    await expect(page).toHaveURL('/');
  });
});
