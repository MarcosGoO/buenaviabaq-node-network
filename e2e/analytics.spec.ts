import { test, expect } from '@playwright/test';

/**
 * E2E — Analytics Dashboard
 *
 * Validates that the analytics page renders its tabs, charts,
 * and key UI elements.
 */

test.describe('Analytics Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/analytics');
    // Wait for main content to appear
    await expect(page.locator('main')).toBeVisible();
  });

  test('should render the analytics page', async ({ page }) => {
    await expect(page).toHaveURL('/analytics');
    await expect(page.locator('main')).toBeVisible();
  });

  test('should display analytics dashboard tab list', async ({ page }) => {
    // Tabs: Patrones, Hotspots, Comparativa, Resumen
    const tabList = page.getByRole('tablist');
    await expect(tabList).toBeVisible({ timeout: 10_000 });
  });

  test('should have a "Resumen" tab', async ({ page }) => {
    const resumenTab = page.getByRole('tab', { name: /resumen/i });
    await expect(resumenTab).toBeVisible({ timeout: 10_000 });
  });

  test('should have a "Hotspots" tab', async ({ page }) => {
    const hotspotsTab = page.getByRole('tab', { name: /hotspot/i });
    await expect(hotspotsTab).toBeVisible({ timeout: 10_000 });
  });

  test('should switch to Resumen tab and show content', async ({ page }) => {
    const resumenTab = page.getByRole('tab', { name: /resumen/i });
    await resumenTab.click();

    // The tab panel should become active / visible
    const activePanel = page.getByRole('tabpanel');
    await expect(activePanel).toBeVisible();
  });

  test('should switch to Hotspots tab and show content', async ({ page }) => {
    const hotspotsTab = page.getByRole('tab', { name: /hotspot/i });
    await hotspotsTab.click();

    const activePanel = page.getByRole('tabpanel');
    await expect(activePanel).toBeVisible();
  });

  test('should switch to Comparativa tab and show content', async ({ page }) => {
    const comparativaTab = page.getByRole('tab', { name: /comparativ/i });
    await comparativaTab.click();

    const activePanel = page.getByRole('tabpanel');
    await expect(activePanel).toBeVisible();
  });

  test('should not display JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/analytics');
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(e =>
      !e.includes('network') && !e.includes('fetch') && !e.includes('CORS')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
