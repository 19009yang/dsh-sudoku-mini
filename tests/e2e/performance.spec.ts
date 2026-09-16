import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('stays responsive and releases intervals after repeated opens and mounts', async ({ page }) => {
  await page.addInitScript(() => {
    const active = new Set<number>();
    const start = window.setInterval.bind(window), stop = window.clearInterval.bind(window);
    Object.defineProperty(window, 'setInterval', { value: (handler: TimerHandler, timeout?: number, ...args: unknown[]) => { const id = start(handler, timeout, ...args); active.add(id); return id; } });
    Object.defineProperty(window, 'clearInterval', { value: (id: number) => { active.delete(id); stop(id); } });
    Object.defineProperty(window, 'activeIntervalCount', { get: () => active.size });
  });
  await page.goto('/');
  const baseline = await page.evaluate(() => Reflect.get(window, 'activeIntervalCount') as number);
  const measurements = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('[data-sudoku-mini]')!.shadowRoot!;
    const launcher = root.querySelector<HTMLElement>('.launcher')!, sudoku = root.querySelector<HTMLElement>('[data-feature="sudoku"]')!, close = root.querySelector<HTMLElement>('.close')!;
    const openTimes: number[] = [], inputTimes: number[] = [];
    for (let i = 0; i < 50; i++) {
      const now = performance.now(); launcher.click(); sudoku.click(); root.querySelector('.panel')!.getBoundingClientRect(); openTimes.push(performance.now() - now); close.click();
    }
    launcher.click(); sudoku.click();
    const cell = root.querySelector<HTMLElement>('.cell:not(.given)')!; cell.click();
    for (let i = 0; i < 100; i++) {
      const now = performance.now(); cell.dispatchEvent(new KeyboardEvent('keydown', { key: i % 2 ? '1' : '2', bubbles: true, composed: true, cancelable: true })); cell.getBoundingClientRect(); inputTimes.push(performance.now() - now);
    }
    close.click();
    const p95 = (values: number[]) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * .95) - 1];
    return { openP95Ms: p95(openTimes), inputP95Ms: p95(inputTimes), firstOpenMs: openTimes[0], opens: openTimes.length, inputs: inputTimes.length };
  });
  expect(measurements.openP95Ms).toBeLessThanOrEqual(100);
  expect(measurements.inputP95Ms).toBeLessThanOrEqual(16);
  expect(await page.evaluate(() => Reflect.get(window, 'activeIntervalCount'))).toBe(baseline);
  for (let i = 0; i < 10; i++) await page.getByRole('button', { name: '重新挂载插件' }).click();
  await expect(page.locator('[data-sudoku-mini]')).toHaveCount(1);
  expect(await page.evaluate(() => Reflect.get(window, 'activeIntervalCount'))).toBe(baseline);
  writeFileSync('artifacts/performance.json', JSON.stringify({ ...measurements, closedIntervals: baseline, mounts: 10, method: 'Synchronous event dispatch including forced layout; fixture only, desktop Chromium; not end-to-end paint latency.' }, null, 2) + '\n');
});
