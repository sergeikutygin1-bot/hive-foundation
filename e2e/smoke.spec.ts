import { expect, test } from '@playwright/test';

test('loads, renders within budget, and places a flower bed through the Shop', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/?seed=1');
  await page.waitForFunction(() => window.__game !== undefined);
  await page.waitForFunction(() => window.__game!.renderInfo().triangles > 0);

  const info = await page.evaluate(() => window.__game!.renderInfo());
  expect(info.calls).toBeLessThan(100);
  expect(await page.evaluate(() => window.__game!.state.inventory.coins)).toBe(60);

  await page.getByRole('button', { name: 'Shop' }).click();
  await page.getByRole('button', { name: /Wildflower bed/ }).click();
  const target = await page.evaluate(() => window.__game!.hexToClient(1, -1));
  await page.mouse.move(target.x, target.y);
  await page.mouse.down();
  await page.mouse.up();

  await expect.poll(() => page.evaluate(() => window.__game!.state.inventory.coins)).toBe(40);
  expect(errors).toEqual([]);
});
