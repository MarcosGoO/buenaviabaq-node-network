import { test, expect } from '@playwright/test';

/**
 * E2E — Navigation & Sidebar
 *
 * Validates that the app loads, the sidebar is present,
 * and navigation between main routes works correctly.
 */

test.describe('Navigation & Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the home page with the sidebar', async ({ page }) => {
    // Sidebar brand text
    await expect(page.getByText('BUENA')).toBeVisible();
    await expect(page.getByText('VIA')).toBeVisible();
  });

  test('sidebar should show navigation links when expanded', async ({ page }) => {
    // Mapa link
    await expect(page.getByRole('link', { name: /mapa/i })).toBeVisible();
    // Analytics link
    await expect(page.getByRole('link', { name: /analytics/i })).toBeVisible();
    // Settings link
    await expect(page.getByRole('link', { name: /settings|configuraci/i })).toBeVisible();
  });

  test('should collapse sidebar on toggle button click', async ({ page }) => {
    const sidebar = page.locator('[class*="w-72"]').first();
    await expect(sidebar).toBeVisible();

    // Find and click the collapse chevron button
    const toggleBtn = page.locator('button').filter({ has: page.locator('svg') }).first();
    await toggleBtn.click();

    // After collapse, the sidebar should narrow (w-20)
    await expect(page.locator('[class*="w-20"]').first()).toBeVisible();
  });

  test('should navigate to Analytics page', async ({ page }) => {
    await page.getByRole('link', { name: /analytics/i }).click();
    await expect(page).toHaveURL('/analytics');
    // The analytics dashboard should render
    await expect(page.locator('main')).toBeVisible();
  });

  test('should navigate to Settings page', async ({ page }) => {
    await page.getByRole('link', { name: /settings|configuraci/i }).click();
    await expect(page).toHaveURL('/settings');
    await expect(page.locator('main')).toBeVisible();
  });

  test('should navigate back to home (map) from analytics', async ({ page }) => {
    await page.goto('/analytics');
    await page.getByRole('link', { name: /mapa/i }).click();
    await expect(page).toHaveURL('/');
  });

  test('home page title should be set', async ({ page }) => {
    await expect(page).toHaveTitle(/.+/); // any non-empty title
  });
});
