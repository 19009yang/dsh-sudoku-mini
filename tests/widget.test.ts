// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createWidget } from '../src/client/widget.ts';
import { createClock } from '../src/client/clock.ts';
import { GAME_KEY } from '../src/client/storage.ts';

let widget: ReturnType<typeof createWidget> | undefined;
beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); Object.defineProperty(document, 'hidden', { configurable: true, value: false }); });
afterEach(() => { widget?.destroy(); widget = undefined; document.body.replaceChildren(); vi.useRealTimers(); });
const root = () => document.querySelector<HTMLElement>('[data-sudoku-mini]')!.shadowRoot!;
it('initializes lazily and cleans timers after close and repeated destroy', () => {
  widget = createWidget(document.body); expect(root().querySelectorAll('.cell')).toHaveLength(0); expect(vi.getTimerCount()).toBe(0);
  (root().querySelector('.launcher') as HTMLElement).click(); vi.advanceTimersByTime(1); expect(root().querySelectorAll('.cell')).toHaveLength(81); expect(vi.getTimerCount()).toBe(1);
  (root().querySelector('.close') as HTMLElement).click(); vi.advanceTimersByTime(1); expect(vi.getTimerCount()).toBe(0);
  widget.destroy(); widget.destroy(); vi.advanceTimersByTime(10); expect(document.querySelector('[data-sudoku-mini]')).toBeNull(); expect(vi.getTimerCount()).toBe(0);
});
it('does not intercept keyboard events outside the game', () => {
  widget = createWidget(document.body); (root().querySelector('.launcher') as HTMLElement).click();
  const input = document.createElement('textarea'); document.body.append(input); input.focus();
  const e = new KeyboardEvent('keydown', { key: '1', bubbles: true, cancelable: true, composed: true }); input.dispatchEvent(e);
  expect(e.defaultPrevented).toBe(false); expect(document.activeElement).toBe(input);
});
it('keeps manual pause when returning from a hidden document', () => {
  widget = createWidget(document.body); (root().querySelector('.launcher') as HTMLElement).click(); (root().querySelector('.pause') as HTMLElement).click();
  vi.advanceTimersByTime(1); expect(vi.getTimerCount()).toBe(0);
  Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange'));
  Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange'));
  vi.advanceTimersByTime(10); expect(vi.getTimerCount()).toBe(0); expect((root().querySelector('.pause-screen') as HTMLElement).hidden).toBe(false);
});
it('invalid storage recovers to a playable board', () => {
  localStorage.setItem(GAME_KEY, '{'); widget = createWidget(document.body); (root().querySelector('.launcher') as HTMLElement).click();
  expect(root().querySelectorAll('.cell')).toHaveLength(81); expect(root().querySelector('.notice')?.textContent).toContain('无法恢复');
});
it('clock settles real elapsed fragments and cannot restart after destruction', () => {
  let elapsed = 0; const clock = createClock(delta => { elapsed += delta; }); clock.setRunning(true);
  vi.advanceTimersByTime(2500); clock.setRunning(false); expect(elapsed).toBe(2500); expect(vi.getTimerCount()).toBe(0);
  vi.advanceTimersByTime(10_000); clock.setRunning(true); vi.advanceTimersByTime(500); clock.destroy(); expect(elapsed).toBe(3000);
  clock.setRunning(true); expect(vi.getTimerCount()).toBe(0);
});
