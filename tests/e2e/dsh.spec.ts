import { expect, test } from '@playwright/test';

test('loads the packaged client in a real DSH shell and keeps the host interactive', async ({ page }) => {
  test.skip(!process.env.DSH_TEST_URL, 'Set DSH_TEST_URL to an isolated DSH instance.');
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.DSH_TEST_URL!);
  const launcher = page.getByRole('button', { name: '打开功能菜单', exact: true });
  await expect(launcher).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-dsh-sudoku-mini]')).toHaveCount(1);
  // Onboarding is asynchronous; a visible launcher does not imply it has finished.
  const continueButton = page.getByRole('button', { name: 'Continue', exact: true });
  const configureLater = page.getByRole('button', { name: 'Configure later', exact: true });
  await expect(continueButton.or(configureLater).first()).toBeVisible();
  if (await continueButton.isVisible()) {
    await continueButton.click();
  }
  // The isolated profile intentionally has no user credentials.
  await expect(configureLater).toBeVisible();
  await configureLater.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await launcher.click();
  const g2048 = page.getByRole('button', { name: '打开2048', exact: true });
  await expect(g2048).toBeVisible();
  await g2048.click();
  await expect(page.getByRole('region', { name: '2048 游戏' })).toBeVisible();
  await expect(page.getByRole('group', { name: '2048 棋盘' })).toBeVisible();
  await page.getByRole('button', { name: '关闭 2048', exact: true }).click();
  await launcher.click(); await page.getByRole('button', { name: '打开数独', exact: true }).click(); await expect(page.getByRole('grid', { name: '数独棋盘' })).toBeVisible();
  const first = page.locator('.cell:not(.given)').first(); await first.click(); await page.keyboard.press('7');
  await expect(first.locator(':scope > span').first()).toHaveText('7'); await page.keyboard.press('Control+z');
  await expect(first.locator(':scope > span').first()).toHaveText('');
  await page.screenshot({ path: 'artifacts/dsh-desktop.png', fullPage: true });
  const oldBoard = await page.locator('.board').textContent();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
  await expect(settings).toBeVisible();
  await expect(settings.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
  await page.screenshot({ path: 'artifacts/dsh-settings.png', fullPage: true });
  await page.keyboard.press('Escape');
  await expect(settings).not.toBeVisible();
  await expect(page.getByRole('region', { name: '数独游戏' })).toBeVisible();
  await page.getByRole('button', { name: 'New session', exact: true }).first().click();
  await expect(page.locator('[data-dsh-sudoku-mini]')).toHaveCount(1);
  expect(await page.locator('.board').textContent()).toBe(oldBoard);
  await first.click();
  await page.keyboard.press('Escape'); await expect(launcher).toBeFocused();
  expect(errors).toEqual([]);
});
