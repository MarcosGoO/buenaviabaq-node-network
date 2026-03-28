import { test, expect } from '@playwright/test';

test.describe('Frontend smoke', () => {
  test('desktop shell renders and allows navigation to settings', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByRole('link', { name: /analytics/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /settings/i })).toBeVisible();

    await page.getByRole('link', { name: /settings/i }).click();
    await expect(page).toHaveURL('/settings');
    await expect(page.getByRole('heading', { name: /configuraci[óo]n/i })).toBeVisible();
  });

  test('mobile shell opens drawer and bottom navigation works', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await expect(page.locator('main')).toBeVisible();

    await page.getByRole('button', { name: /abrir menú|abrir menu/i }).click();
    await expect(page.getByText(/panel principal/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /^datos$/i })).toBeVisible();

    await page.getByRole('link', { name: /^ajustes$/i }).click();
    await expect(page).toHaveURL('/settings');
    await expect(page.getByRole('heading', { name: /configuraci[óo]n/i })).toBeVisible();
  });
});
