import { expect, test } from '@playwright/test';

test('a minister can enter the playable Lima map', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /new game/i }).click();
  await page.getByRole('button', { name: /become minister/i }).click();

  await expect(page.getByText('Lima, Peru')).toBeVisible();
  const map = page.getByRole('region', { name: 'Simulated traffic map of Lima' });
  await expect(map).toBeVisible();
  const mapBounds = await map.boundingBox();
  expect(mapBounds?.height).toBeGreaterThan(0);
  expect(mapBounds?.width).toBeGreaterThan(0);
  await expect(page.getByText('Choose a corridor')).toBeVisible();
});
