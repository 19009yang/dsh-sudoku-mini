import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/'); });
async function openSudoku(page: Page): Promise<void> {
  await page.getByRole('button', { name: '打开功能菜单', exact: true }).click();
  await page.getByRole('button', { name: '打开数独', exact: true }).click();
}
test('fans three features clockwise and keeps placeholders reserved', async ({ page }) => {
  const launcher = page.locator('.launcher');
  await page.getByRole('button', { name: '打开功能菜单', exact: true }).click();
  const sudoku = page.getByRole('button', { name: '打开数独', exact: true });
  const extensionOne = page.getByRole('button', { name: '扩展功能一，敬请期待', exact: true });
  const extensionTwo = page.getByRole('button', { name: '扩展功能二，敬请期待', exact: true });
  await expect(sudoku).toBeVisible(); await expect(extensionOne).toBeVisible(); await expect(extensionTwo).toBeVisible();
  await expect.poll(async () => {
    const [main, first, second, third] = await Promise.all([launcher.boundingBox(), sudoku.boundingBox(), extensionOne.boundingBox(), extensionTwo.boundingBox()]);
    return Boolean(main && first && second && third && first.x < main.x - 50 && second.x < main.x - 34 && second.y < main.y - 34 && third.y < main.y - 50);
  }).toBe(true);
  const [mainBox, sudokuBox, oneBox, twoBox] = await Promise.all([launcher.boundingBox(), sudoku.boundingBox(), extensionOne.boundingBox(), extensionTwo.boundingBox()]);
  expect(mainBox).not.toBeNull(); expect(sudokuBox).not.toBeNull(); expect(oneBox).not.toBeNull(); expect(twoBox).not.toBeNull();
  expect(sudokuBox!.x).toBeLessThan(mainBox!.x); expect(Math.abs(sudokuBox!.y - mainBox!.y)).toBeLessThan(6);
  expect(oneBox!.x).toBeLessThan(mainBox!.x); expect(oneBox!.y).toBeLessThan(mainBox!.y);
  expect(Math.abs(twoBox!.x - mainBox!.x)).toBeLessThan(6); expect(twoBox!.y).toBeLessThan(mainBox!.y);
  await expect(extensionOne).toHaveAttribute('aria-disabled', 'true'); await expect(extensionTwo).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: '打开功能菜单', exact: true })).toBeFocused(); await expect(sudoku).not.toBeVisible();
});
test('fills, notes, undoes and restores after refresh without changing host input', async ({ page }) => {
  const input = page.getByRole('textbox', { name: '宿主输入框' }); await input.fill('123 abc');
  await openSudoku(page);
  await page.screenshot({ path: 'artifacts/preview-desktop.png', fullPage: true });
  const first = page.locator('.cell:not(.given)').first(); await first.click(); await page.keyboard.press('1'); await expect(first.locator(':scope > span').first()).toHaveText('1');
  await page.keyboard.press('n'); await page.keyboard.press('2'); await expect(first.locator('.notes')).toContainText('2');
  await page.getByRole('button', { name: '撤销', exact: true }).click(); await expect(first.locator(':scope > span').first()).toHaveText('1');
  await page.getByRole('button', { name: '关闭数独' }).click(); await input.click(); await page.keyboard.press('End'); await page.keyboard.type('9'); await expect(input).toHaveValue('123 abc9');
  await page.reload(); await openSudoku(page); await expect(page.locator('.cell:not(.given)').first().locator(':scope > span').first()).toHaveText('1');
});
test('continues fixture streaming and leaves host modal accessible', async ({ page }) => {
  await page.getByRole('button', { name: '发送', exact: true }).click(); await openSudoku(page);
  await expect(page.locator('#stream')).toContainText('输出片段 3');
  await page.getByRole('button', { name: '打开审批弹窗' }).click(); await page.getByRole('button', { name: '允许', exact: true }).click(); await expect(page.locator('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: '停止', exact: true }).click();
});
test('canceling a new game keeps the current board', async ({ page }) => {
  await openSudoku(page); await page.locator('.cell:not(.given)').first().click(); await page.keyboard.press('3');
  const old = await page.locator('.board').textContent(); await page.getByRole('button', { name: '新游戏', exact: true }).click(); await page.getByRole('button', { name: '取消', exact: true }).click(); expect(await page.locator('.board').textContent()).toBe(old);
});
test('closes with Escape and returns focus to the launcher', async ({ page }) => {
  await openSudoku(page); await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '打开功能菜单', exact: true })).toBeFocused(); await expect(page.getByRole('region', { name: '数独游戏' })).not.toBeVisible();
});
test('dragging the launcher does not open it', async ({ page }) => {
  const b = await page.getByRole('button', { name: '打开功能菜单', exact: true }).boundingBox(); expect(b).not.toBeNull();
  await page.mouse.move(b!.x + 20, b!.y + 20); await page.mouse.down(); await page.mouse.move(b!.x - 100, b!.y - 100, { steps: 10 }); await page.mouse.up();
  await expect(page.getByRole('region', { name: '数独游戏' })).not.toBeVisible(); await openSudoku(page); await expect(page.getByRole('grid')).toBeVisible();
});
test('survives repeated mounts and preserves host keyboard editing', async ({ page }) => {
  for (let i = 0; i < 10; i++) await page.getByRole('button', { name: '重新挂载插件' }).click();
  await expect(page.locator('[data-sudoku-mini]')).toHaveCount(1);
  await openSudoku(page); const input = page.getByRole('textbox', { name: '宿主输入框' }); await input.fill('12'); await input.press('ArrowLeft'); await input.press('Backspace'); await expect(input).toHaveValue('2');
});
test('fits mobile and keeps all controls reachable', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 }); await openSudoku(page);
  const box = await page.getByRole('region', { name: '数独游戏' }).boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(360);
  await page.screenshot({ path: 'artifacts/preview-mobile.png', fullPage: true });
  await page.getByRole('button', { name: '更多设置' }).click(); await page.getByLabel('主题', { exact: true }).selectOption('dark'); await page.getByRole('button', { name: '关闭数独' }).click();
  await expect(page.getByRole('button', { name: '打开功能菜单', exact: true })).toBeVisible();
});
