import { acknowledgeWin, createGame, maxTile, move } from '../../game2048/engine.ts';
import { defaultJoystick, idleJoystick, joystickDown, joystickMove, joystickUp, touchJoystick, type JoystickConfig, type JoystickState } from '../../game2048/joystick.ts';
import type { Direction, Game2048 } from '../../game2048/types.ts';
import { newSeed } from '../../shared/random.ts';
import { readG2048, readG2048Best, saveG2048 } from '../storage.ts';
import type { ToolContext, ToolInstance, ToolModule } from './types.ts';

const icon2048 = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></svg>';

const markup = `<header class="header"><span class="title">2048</span><span class="g-stat">分数 <b class="g-score">0</b></span><span class="g-stat">最高 <b class="g-best">0</b></span><button class="icon-button close" aria-label="关闭 2048" title="关闭">×</button></header><div class="g-board" role="group" aria-label="2048 棋盘" tabindex="0"><div class="g-cells" aria-hidden="true"></div><div class="g-tiles"></div></div><div class="g-stick" data-active="false"><div class="g-stick-base" role="group" aria-label="方向摇杆，按方向拖动以移动数字" tabindex="0"><span class="g-stick-knob"></span></div></div><footer class="footer"><button class="new-game">新游戏</button><span class="g-tip">拖动圆钮决定方向</span></footer><div class="dialog" hidden></div><p class="notice" role="status" aria-live="polite"></p>`;

const KEYS: Record<string, Direction> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down', A: 'left', D: 'right', W: 'up', S: 'down' };

function mount2048(container: HTMLElement, ctx: ToolContext): ToolInstance {
  container.innerHTML = markup;
  const el = <T extends HTMLElement = HTMLElement>(selector: string): T => { const found = container.querySelector<T>(selector); if (!found) throw new Error(`缺少组件 ${selector}`); return found; };
  const board = el('.g-board'), tilesLayer = el('.g-tiles'), cellsLayer = el('.g-cells'), base = el('.g-stick-base'), stick = el('.g-stick'), knob = el('.g-stick-knob'), dialog = el('.dialog');
  for (let cell = 0; cell < 16; cell++) cellsLayer.append(document.createElement('span'));
  const saved = readG2048();
  let game: Game2048 = saved.game ?? createGame(newSeed());
  let best = Math.max(readG2048Best(), game.score);
  let stickState: JoystickState = idleJoystick, stickConfig: JoystickConfig = defaultJoystick, stickId: number | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | null = null, destroyed = false;
  const nodes = new Map<number, HTMLDivElement>();
  const cleanup: (() => void)[] = [];
  const on = (target: EventTarget, name: string, handler: EventListener): void => { target.addEventListener(name, handler); cleanup.push(() => target.removeEventListener(name, handler)); };

  function persist(): void {
    if (saveTimer !== null) { clearTimeout(saveTimer); saveTimer = null; }
    if (!saveG2048(game, best)) ctx.notify('浏览器无法保存进度，本次仍可正常游玩。');
  }
  function scheduleSave(): void { if (saveTimer !== null) clearTimeout(saveTimer); saveTimer = setTimeout(() => { saveTimer = null; persist(); }, 350); }
  function closeDialog(): void { dialog.hidden = true; dialog.replaceChildren(); }
  function showDialog(text: string, actions: [string, () => void][], primaryLast: boolean): void {
    closeDialog();
    const p = document.createElement('p'); p.textContent = text;
    const row = document.createElement('div'); row.className = 'actions';
    actions.forEach(([label, run], index) => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
      if (primaryLast && index === actions.length - 1) button.className = 'primary';
      button.addEventListener('click', () => { closeDialog(); run(); });
      row.append(button);
    });
    dialog.append(p, row); dialog.hidden = false; ctx.position();
    row.querySelector('button')?.focus({ preventScroll: true });
  }
  function render(spawned: number | null = null, merged: readonly number[] = []): void {
    if (game.score > best) best = game.score;
    el('.g-score').textContent = String(game.score);
    el('.g-best').textContent = String(best);
    const alive = new Set<number>();
    for (const tile of game.tiles) {
      alive.add(tile.id);
      let node = nodes.get(tile.id);
      if (!node) {
        node = document.createElement('div'); node.className = 'g-tile';
        // Position before insertion so the first paint never animates from the origin.
        node.style.setProperty('--g-row', String(tile.row)); node.style.setProperty('--g-col', String(tile.col));
        tilesLayer.append(node); nodes.set(tile.id, node);
      } else { node.style.setProperty('--g-row', String(tile.row)); node.style.setProperty('--g-col', String(tile.col)); }
      node.textContent = String(tile.value); node.dataset.value = String(tile.value);
      if (tile.value > 2048) node.dataset.big = 'true'; else delete node.dataset.big;
      node.classList.toggle('is-new', tile.id === spawned);
      node.classList.toggle('is-merged', merged.includes(tile.id));
    }
    for (const [id, node] of nodes) if (!alive.has(id)) { node.remove(); nodes.delete(id); }
  }
  function settle(): void {
    if (!dialog.hidden) return;
    if (!game.won && maxTile(game.tiles) >= 2048) { game = acknowledgeWin(game); scheduleSave(); showDialog('达成 2048！继续挑战，还是重新开始？', [['继续挑战', () => { board.focus({ preventScroll: true }); }], ['新游戏', newGame]], true); return; }
    if (game.status === 'over') showDialog(`无可用移动，最终得分 ${game.score}。`, [['新游戏', newGame]], true);
  }
  function apply(direction: Direction): void {
    if (!dialog.hidden) return;
    const outcome = move(game, direction);
    if (!outcome.moved) return;
    game = outcome.game;
    render(outcome.spawned, outcome.merged);
    scheduleSave(); settle();
  }
  function newGame(): void {
    game = createGame(newSeed());
    for (const node of nodes.values()) node.remove();
    nodes.clear(); closeDialog(); render(); scheduleSave();
    board.focus({ preventScroll: true });
  }
  function requestNewGame(): void {
    if (game.moves === 0 || game.status === 'over') { newGame(); return; }
    showDialog('开始新游戏将替换当前进度。', [['取消', () => { board.focus({ preventScroll: true }); }], ['开始新游戏', newGame]], true);
  }
  function resetStick(): void {
    stickState = joystickUp(stickState);
    stick.dataset.active = 'false';
    knob.style.transform = 'translate(0px, 0px)';
    stickId = null;
  }

  el('.close').addEventListener('click', () => ctx.close());
  el('.new-game').addEventListener('click', requestNewGame);
  on(base, 'pointerdown', event => {
    const e = event as PointerEvent;
    if (e.button !== 0) return;
    e.preventDefault();
    stickConfig = e.pointerType === 'touch' ? touchJoystick : defaultJoystick;
    stickState = joystickDown(e.clientX, e.clientY, performance.now());
    stick.dataset.active = 'true'; stickId = e.pointerId;
    base.setPointerCapture(e.pointerId);
  });
  on(base, 'pointermove', event => {
    const e = event as PointerEvent;
    if (!stickState.active || e.pointerId !== stickId) return;
    e.preventDefault();
    const step = joystickMove(stickState, e.clientX, e.clientY, performance.now(), stickConfig);
    stickState = step.state;
    knob.style.transform = `translate(${stickState.knobX}px, ${stickState.knobY}px)`;
    if (step.direction) apply(step.direction);
  });
  on(base, 'pointerup', event => { if ((event as PointerEvent).pointerId === stickId) resetStick(); });
  on(base, 'pointercancel', () => resetStick());
  on(container, 'keydown', event => {
    const e = event as KeyboardEvent;
    if (e.isComposing) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (!dialog.hidden) { closeDialog(); board.focus({ preventScroll: true }); } else ctx.close(); return; }
    const target = e.composedPath()[0];
    if (target instanceof HTMLElement && ['BUTTON', 'SELECT', 'INPUT', 'TEXTAREA'].includes(target.tagName)) return;
    const direction = KEYS[e.key];
    if (!direction || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault(); e.stopPropagation(); apply(direction);
  });
  on(document, 'visibilitychange', () => { if (document.hidden) persist(); });
  on(window, 'pagehide', () => persist());

  if (saved.error) ctx.notify('无法恢复上一局，已开始新游戏。');
  render();
  board.focus({ preventScroll: true });

  return {
    destroy() {
      if (destroyed) return; destroyed = true;
      persist();
      for (const dispose of cleanup.reverse()) dispose();
      if (stickId !== null && base.hasPointerCapture(stickId)) base.releasePointerCapture(stickId);
      resetStick();
      nodes.clear();
    },
  };
}

export const g2048Tool: ToolModule = { id: 'g2048', label: '2048', icon: icon2048, regionLabel: '2048 游戏', mount: mount2048 };
