import { test, expect } from '@playwright/test';

test('guests complete autonomous service; pause, upgrade and restart work', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Little Sushi Shop' })).toBeVisible();
  await page.clock.runFor(30000);
  await expect(page.locator('#served')).not.toHaveText('0 served');
  const coins = Number((await page.locator('#coins').innerText()).split(' ')[0]);
  expect(coins).toBeGreaterThan(100);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const clock = await page.locator('#clock').innerText();
  await page.clock.runFor(5000);
  await expect(page.locator('#clock')).toHaveText(clock);
  await page.getByRole('button', { name: 'Upgrade · 75 coins' }).click();
  await page.clock.runFor(100);
  await expect(page.locator('#coins')).toHaveText(`${coins - 75} coins`);
  await expect(page.locator('#upgrade')).toBeDisabled();
  await page.screenshot({ path: 'test-results/restaurant-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Restart' }).click();
  await page.clock.runFor(100);
  await expect(page.locator('#coins')).toHaveText('100 coins');
  await expect(page.locator('#served')).toHaveText('0 served');
  expect(errors).toEqual([]);
});

test('mobile layout keeps controls and canvas inside viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }));
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport);
  await page.screenshot({ path: 'test-results/restaurant-mobile.png', fullPage: true });
});
