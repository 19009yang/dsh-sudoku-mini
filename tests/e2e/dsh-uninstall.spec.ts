import { expect, test } from '@playwright/test';

test('has no Sudoku launcher after CLI uninstall and host restart', async ({ page }) => {
  test.skip(!process.env.DSH_UNINSTALLED_TEST_URL, 'Set DSH_UNINSTALLED_TEST_URL to the restarted isolated host.');
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.DSH_UNINSTALLED_TEST_URL!);
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible({ timeout: 30_000 });
  const entries = await page.evaluate(() => {
    const boot = Reflect.get(window, '__DSH_BOOT__');
    if (!boot || !Array.isArray(boot.entries)) throw new Error('DSH boot entries are unavailable.');
    return JSON.stringify(boot.entries);
  });
  expect(entries).not.toContain('dsh-sudoku-mini');
  await expect(page.locator('[data-dsh-sudoku-mini]')).toHaveCount(0);
  await expect(page.locator('[data-sudoku-mini]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '打开数独', exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});
