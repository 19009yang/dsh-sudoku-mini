import { styles } from './styles.ts';
import { createClock, formatTime } from './clock.ts';
import { readGame, readSettings, saveGame } from './storage.ts';
import { createGame, newSeed, pickPuzzle, puzzles } from '../game/puzzles.ts';
import { reduceGame } from '../game/reducer.ts';
import { getHint, type Hint } from '../game/hints.ts';
import { bit, conflicts, peers } from '../game/rules.ts';
import { difficultyLabels, difficulties, type Digit, type GameAction, type GameState } from '../game/types.ts';

const sudokuIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>';
const launcherIcon = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="7" cy="7" r="2"/><circle cx="17" cy="7" r="2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>';
const extensionIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const features = [
  { id: 'sudoku', label: '数独', icon: sudokuIcon, available: true },
  { id: 'extension-one', label: '扩展功能一', icon: extensionIcon, available: false },
  { id: 'extension-two', label: '扩展功能二', icon: extensionIcon, available: false },
] as const;

export function createWidget(container: HTMLElement): { destroy(): void } {
  const host = document.createElement('div'); host.dataset.sudokuMini = ''; host.lang = 'zh-CN'; host.dir = 'ltr'; host.style.pointerEvents = 'none'; container.append(host);
  const root = host.attachShadow({ mode: 'open' });
  const featureMarkup = features.map(feature => `<button class="feature-button" type="button" data-feature="${feature.id}" aria-label="${feature.available ? '打开' : ''}${feature.label}${feature.available ? '' : '，敬请期待'}"${feature.available ? '' : ' aria-disabled="true"'} tabindex="-1" title="${feature.available ? feature.label : `${feature.label} · 敬请期待`}">${feature.icon}</button>`).join('');
  root.innerHTML = `<style>${styles}</style><div class="launcher-group" data-menu-open="false" data-quadrant="bottom-right"><div class="feature-menu" id="sudoku-feature-menu" role="group" aria-label="功能菜单" aria-hidden="true">${featureMarkup}</div><button class="launcher" type="button" aria-label="打开功能菜单" aria-expanded="false" aria-controls="sudoku-feature-menu" title="功能菜单 · 拖动可移动">${launcherIcon}</button><span class="launcher-status" role="status" aria-live="polite"></span></div><section class="panel" role="region" aria-label="数独游戏" hidden><header class="header"><span class="title">数独</span><select class="difficulty" aria-label="难度"></select><button class="icon-button pause" aria-label="暂停" title="暂停">Ⅱ</button><button class="icon-button close" aria-label="关闭数独" title="关闭">×</button></header><div class="status"><span class="clock">00:00</span><span class="progress"></span></div><div class="board-wrap"><div class="board" role="grid" aria-label="数独棋盘"></div><div class="pause-screen" hidden><button class="resume">继续游戏</button></div></div><div class="digits" aria-label="数字输入"></div><div class="toolbar"><button class="tool undo" title="Ctrl/Cmd + Z">撤销</button><button class="tool erase" title="Delete">擦除</button><button class="tool notes-toggle" aria-pressed="false" title="N">笔记</button><button class="tool hint-button">提示</button></div><footer class="footer"><button class="new-game">新游戏</button><button class="more" aria-label="更多设置" aria-expanded="false">更多 ⋯</button></footer><div class="dialog" hidden></div><p class="notice" role="status" aria-live="polite"></p></section>`;
  const el = <T extends HTMLElement = HTMLElement>(selector: string): T => { const found = root.querySelector<T>(selector); if (!found) throw new Error(`缺少组件 ${selector}`); return found; };
  const launcherGroup = el('.launcher-group'), featureMenu = el('.feature-menu'), launcher = el<HTMLButtonElement>('.launcher'), sudokuFeature = el<HTMLButtonElement>('[data-feature="sudoku"]');
  const panel = el('.panel'), board = el('.board'), dialog = el('.dialog'), difficulty = el<HTMLSelectElement>('.difficulty');
  let settings = readSettings(), game: GameState | null = null, menuOpen = false, open = false, manualPaused = false, destroyed = false, hint: Hint | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | null = null, revision = 0, checkpoint = 0, suppressClick = false;
  const tabId = String(newSeed()), recent: string[] = [], cells: HTMLButtonElement[] = [];
  const cleanup: (() => void)[] = [];
  let drag: { target: HTMLElement; id: number; startX: number; startY: number; x: number; y: number; moved: boolean; panel: boolean } | null = null;
  const notice = (text: string) => { el('.notice').textContent = text; };
  const clock = createClock(elapsed => { if (game) { game = { ...game, elapsedMs: game.elapsedMs + elapsed }; updateTime(); if (game.elapsedMs - checkpoint >= 15_000) { checkpoint = game.elapsedMs; persist(false); } } });
  function updateTime(): void { el('.clock').textContent = formatTime(game?.elapsedMs ?? 0); }
  function syncClock(): void { clock.setRunning(open && !document.hidden && !manualPaused && game?.status === 'playing'); }
  function persist(settle = true): void {
    if (saveTimer !== null) { clearTimeout(saveTimer); saveTimer = null; }
    if (settle) clock.settle();
    if (!saveGame(game, settings, tabId, ++revision)) notice('浏览器无法保存进度，本次仍可正常游玩。');
  }
  function scheduleSave(): void { if (saveTimer !== null) clearTimeout(saveTimer); saveTimer = setTimeout(() => { saveTimer = null; persist(); }, 350); }
  function on(target: EventTarget, name: string, handler: EventListener): void { target.addEventListener(name, handler); cleanup.push(() => target.removeEventListener(name, handler)); }
  function focusCell(): void { if (game?.selectedCell !== null && game?.selectedCell !== undefined && !manualPaused) cells[game.selectedCell]?.focus({ preventScroll: true }); }
  function position(): void {
    const viewport = window.visualViewport;
    const width = viewport?.width ?? window.innerWidth, height = viewport?.height ?? window.innerHeight;
    const ox = viewport?.offsetLeft ?? 0, oy = viewport?.offsetTop ?? 0;
    const clamp = (n: number, max: number) => Math.max(12, Math.min(Math.max(12, max - 60), n));
    const x = clamp(settings.position ? settings.position.x * width : width - 68, width);
    const y = clamp(settings.position ? settings.position.y * height : height - 144, height);
    launcherGroup.style.left = `${x + ox}px`; launcherGroup.style.top = `${y + oy}px`;
    launcherGroup.dataset.quadrant = `${y + 24 < height / 2 ? 'top' : 'bottom'}-${x + 24 < width / 2 ? 'left' : 'right'}`;
    panel.style.maxHeight = `${Math.max(120, height - 24)}px`;
    if (open) {
      const w = panel.offsetWidth || Math.min(340, width - 24), h = panel.offsetHeight || 500;
      panel.style.left = `${ox + Math.max(12, Math.min(width - w - 12, x + 48 - w))}px`;
      panel.style.top = `${oy + Math.max(12, Math.min(height - h - 12, y >= h + 24 ? y - h - 8 : y + 56))}px`;
    }
  }
  function setMenuOpen(value: boolean): void {
    menuOpen = value;
    launcherGroup.dataset.menuOpen = String(value);
    featureMenu.setAttribute('aria-hidden', String(!value));
    launcher.setAttribute('aria-expanded', String(value));
    launcher.setAttribute('aria-label', value ? '收起功能菜单' : '打开功能菜单');
    for (const feature of root.querySelectorAll<HTMLButtonElement>('.feature-button')) feature.tabIndex = value ? 0 : -1;
    position();
  }
  function closeDialog(): void { dialog.hidden = true; dialog.replaceChildren(); hint = null; el('.more').setAttribute('aria-expanded', 'false'); }
  function button(text: string, fn: () => void, primary = false): HTMLButtonElement { const b = document.createElement('button'); b.type = 'button'; b.textContent = text; if (primary) b.className = 'primary'; b.addEventListener('click', fn); return b; }
  function confirm(text: string, accept: string, fn: () => void): void {
    closeDialog(); const p = document.createElement('p'); p.textContent = text; const actions = document.createElement('div'); actions.className = 'actions';
    actions.append(button('取消', () => { closeDialog(); difficulty.value = currentDifficulty(); render(); focusCell(); }), button(accept, () => { closeDialog(); fn(); }, true));
    dialog.append(p, actions); dialog.hidden = false; position(); actions.querySelector('button')?.focus({ preventScroll: true });
  }
  function currentDifficulty(): string { return puzzles.find(p => p.id === game?.puzzleId)?.difficulty ?? settings.difficulty; }
  function render(): void {
    if (!game) return;
    host.dataset.theme = settings.theme; panel.dataset.paused = String(manualPaused);
    el('.pause-screen').hidden = !manualPaused; difficulty.value = currentDifficulty(); updateTime();
    const filled = game.values.filter((v, i) => v && !game!.givens[i]).length, total = game.givens.filter(v => !v).length;
    el('.progress').textContent = game.status === 'won' ? `已完成 · 提示 ${game.hintCount} 次` : `已填 ${filled}/${total}`;
    el('.progress').classList.toggle('won', game.status === 'won');
    const errors = conflicts(game.values), selected = game.selectedCell;
    cells.forEach((cell, i) => {
      const value = game!.values[i], noteMask = game!.notes[i];
      const className = ['cell', game!.givens[i] ? 'given' : '', selected === i ? 'selected' : '', selected !== null && peers[selected].includes(i) ? 'peer' : '', selected !== null && value && value === game!.values[selected] ? 'same' : '', errors.has(i) || settings.answerCheck && value && value !== game!.solution[i] ? 'error' : '', hint?.index === i ? 'hint' : ''].filter(Boolean).join(' ');
      if (cell.className !== className) cell.className = className;
      cell.tabIndex = selected === i ? 0 : -1; cell.setAttribute('aria-selected', String(selected === i)); cell.setAttribute('aria-readonly', String(Boolean(game!.givens[i])));
      cell.setAttribute('aria-label', `第 ${Math.floor(i / 9) + 1} 行第 ${i % 9 + 1} 列，${value || '空格'}${game!.givens[i] ? '，固定数字' : ''}${errors.has(i) ? '，冲突' : ''}${!value && noteMask ? '，笔记 ' + Array.from({ length: 9 }, (_, d) => d + 1).filter(d => noteMask & bit(d)).join(' ') : ''}`);
      const text = value ? String(value) : '';
      if (cell.firstElementChild!.textContent !== text) cell.firstElementChild!.textContent = text;
      const notes = cell.lastElementChild! as HTMLElement; notes.hidden = Boolean(value) || !noteMask;
      if (noteMask && !notes.children.length) for (let d = 0; d < 9; d++) notes.append(document.createElement('span'));
      for (let d = 1; d <= notes.children.length; d++) { const text = noteMask & bit(d) ? String(d) : ''; if (notes.children[d - 1].textContent !== text) notes.children[d - 1].textContent = text; }
      cell.disabled = manualPaused;
    });
    el<HTMLButtonElement>('.undo').disabled = !game.history.length || manualPaused;
    el<HTMLButtonElement>('.erase').disabled = selected === null || Boolean(game.givens[selected]) || manualPaused || game.status === 'won';
    el('.notes-toggle').setAttribute('aria-pressed', String(game.noteMode));
    el<HTMLButtonElement>('.notes-toggle').disabled = manualPaused || game.status === 'won';
    el<HTMLButtonElement>('.hint-button').disabled = manualPaused || game.status === 'won';
    el<HTMLButtonElement>('.pause').disabled = game.status === 'won';
    el('.pause').setAttribute('aria-label', manualPaused ? '继续游戏' : '暂停'); el('.pause').textContent = manualPaused ? '▷' : 'Ⅱ';
    for (const b of root.querySelectorAll<HTMLButtonElement>('.digit')) b.disabled = manualPaused || game.status === 'won' || selected === null || Boolean(game.givens[selected]);
    syncClock(); position();
  }
  function dispatch(action: GameAction): void {
    if (!game || manualPaused && action.type !== 'select') return;
    clock.settle(); const previous = game.status; game = reduceGame(game, action, settings.autoClean); hint = null;
    if (action.type !== 'select' && !dialog.hidden) closeDialog();
    if (game.status === 'won' && previous !== 'won') notice(`完成！用时 ${formatTime(game.elapsedMs)}，使用提示 ${game.hintCount} 次。`);
    else if (previous === 'won' && game.status !== 'won') notice('已撤销，继续游戏。');
    render(); scheduleSave();
  }
  function start(d = settings.difficulty, restart = false): void {
    clock.setRunning(false);
    const puzzle = restart && game ? puzzles.find(p => p.id === game!.puzzleId)! : pickPuzzle(d, recent);
    game = createGame(puzzle, restart && game ? game.transformSeed : newSeed()); settings.difficulty = puzzle.difficulty;
    recent.push(puzzle.id); if (recent.length > 10) recent.shift(); checkpoint = 0; manualPaused = false; closeDialog(); notice(''); render(); persist(); focusCell();
  }
  function requestStart(d = settings.difficulty, restart = false): void {
    if (game && game.values.some((v, i) => v !== game!.givens[i]) || game?.notes.some(Boolean)) confirm(restart ? '重新开始将清空当前题的填写和笔记。' : '开始新游戏将替换当前进度。', restart ? '重新开始' : '开始新游戏', () => start(d, restart));
    else start(d, restart);
  }
  function setOpen(value: boolean): void {
    const hadFocus = root.activeElement !== null && panel.contains(root.activeElement);
    open = value; panel.hidden = !open; sudokuFeature.setAttribute('aria-label', open ? '收起数独' : '打开数独');
    if (open) {
      if (!cells.length) initBoard();
      if (!game) { const saved = readGame(); game = saved.game; if (!game) start(); else { settings.difficulty = currentDifficulty() as typeof settings.difficulty; render(); } if (saved.error) notice('无法恢复上一局，已开始新游戏。'); }
      render(); focusCell();
    } else { syncClock(); persist(); closeDialog(); if (hadFocus) launcher.focus({ preventScroll: true }); }
    position();
  }
  function initBoard(): void {
    for (let r = 0; r < 9; r++) {
      const row = document.createElement('div'); row.className = 'row'; row.setAttribute('role', 'row');
      for (let c = 0; c < 9; c++) {
        const i = r * 9 + c, cell = document.createElement('button'); cell.type = 'button'; cell.className = 'cell'; cell.dataset.index = String(i); cell.setAttribute('role', 'gridcell');
        const value = document.createElement('span'), notes = document.createElement('span'); notes.className = 'notes'; notes.setAttribute('aria-hidden', 'true');
        cell.append(value, notes); cell.addEventListener('click', () => { dispatch({ type: 'select', index: i }); focusCell(); }); row.append(cell); cells.push(cell);
      }
      board.append(row);
    }
  }
  function showHint(): void {
    if (!game) return;
    const next = getHint(game); if (!next) return;
    if (next.kind === 'error') { closeDialog(); hint = next; game = { ...game, selectedCell: next.index }; notice(next.text); render(); focusCell(); return; }
    confirm(next.text, next.kind === 'reveal' ? '揭示答案' : `填入 ${next.digit}`, () => { dispatch({ type: 'hint', index: next.index, digit: next.digit }); focusCell(); });
    hint = next; render();
  }
  function showSettings(): void {
    if (!dialog.hidden) { closeDialog(); position(); return; }
    el('.more').setAttribute('aria-expanded', 'true');
    const checkbox = (text: string, checked: boolean, change: (value: boolean) => void) => {
      const label = document.createElement('label'); label.className = 'settings-row'; label.append(document.createTextNode(text)); const input = document.createElement('input'); input.type = 'checkbox'; input.checked = checked;
      input.addEventListener('change', () => { change(input.checked); render(); scheduleSave(); }); label.append(input); dialog.append(label);
    };
    checkbox('对照答案检查错误', settings.answerCheck, value => { settings.answerCheck = value; });
    checkbox('填数时清理关联笔记', settings.autoClean, value => { settings.autoClean = value; });
    const label = document.createElement('label'); label.className = 'settings-row'; label.textContent = '主题'; const select = document.createElement('select'); select.setAttribute('aria-label', '主题');
    for (const [value, text] of [['system', '跟随系统'], ['light', '浅色'], ['dark', '深色']]) { const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option); }
    select.value = settings.theme; select.addEventListener('change', () => { settings.theme = select.value as typeof settings.theme; render(); scheduleSave(); }); label.append(select); dialog.append(label);
    dialog.append(button('重开当前题', () => requestStart(settings.difficulty, true)), button('重置窗口位置', () => { settings.position = null; position(); scheduleSave(); })); dialog.hidden = false; position();
  }
  for (const d of difficulties) { const option = document.createElement('option'); option.value = d; option.textContent = difficultyLabels[d]; difficulty.append(option); }
  for (let d = 1; d <= 9; d++) { const b = button(String(d), () => { dispatch({ type: 'enter', digit: d as Digit }); focusCell(); }); b.className = 'digit'; b.setAttribute('aria-label', `填入 ${d}`); el('.digits').append(b); }
  const click = (selector: string, fn: () => void) => on(el(selector), 'click', () => fn());
  click('.launcher', () => { if (suppressClick) { suppressClick = false; return; } setMenuOpen(!menuOpen); });
  click('[data-feature="sudoku"]', () => { const next = !open; setMenuOpen(false); setOpen(next); if (!next) launcher.focus({ preventScroll: true }); });
  for (const feature of features.filter(feature => !feature.available)) click(`[data-feature="${feature.id}"]`, () => { el('.launcher-status').textContent = `${feature.label}尚未开放`; });
  click('.close', () => setOpen(false));
  click('.undo', () => { dispatch({ type: 'undo' }); focusCell(); }); click('.erase', () => { dispatch({ type: 'erase' }); focusCell(); });
  click('.notes-toggle', () => { dispatch({ type: 'noteMode' }); focusCell(); }); click('.hint-button', showHint);
  click('.new-game', () => requestStart()); click('.more', showSettings);
  const togglePause = () => { closeDialog(); manualPaused = !manualPaused; render(); persist(); if (manualPaused) el('.resume').focus({ preventScroll: true }); else focusCell(); };
  click('.pause', togglePause); click('.resume', togglePause);
  on(difficulty, 'change', () => { const d = difficulty.value as typeof settings.difficulty; difficulty.value = currentDifficulty(); requestStart(d); });
  on(root, 'keydown', event => {
    const e = event as KeyboardEvent;
    if (e.isComposing) return;
    if (e.key === 'Escape' && menuOpen) { e.preventDefault(); e.stopPropagation(); setMenuOpen(false); launcher.focus({ preventScroll: true }); return; }
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (!dialog.hidden) { closeDialog(); render(); focusCell(); } else setOpen(false); return; }
    const target = e.composedPath()[0]; if (!(target instanceof HTMLElement) || !target.classList.contains('cell') || manualPaused) return;
    let handled = true; const selected = game?.selectedCell ?? 0;
    if (/^[1-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) dispatch({ type: 'enter', digit: Number(e.key) as Digit });
    else if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'z') dispatch({ type: 'undo' });
    else if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'Delete' || e.key === 'Backspace')) dispatch({ type: 'erase' });
    else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'n') dispatch({ type: 'noteMode' });
    else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.startsWith('Arrow')) { const row = Math.floor(selected / 9), col = selected % 9; const index = e.key === 'ArrowLeft' ? row * 9 + Math.max(0, col - 1) : e.key === 'ArrowRight' ? row * 9 + Math.min(8, col + 1) : e.key === 'ArrowUp' ? Math.max(0, row - 1) * 9 + col : Math.min(8, row + 1) * 9 + col; dispatch({ type: 'select', index }); }
    else handled = false;
    if (handled) { e.preventDefault(); e.stopPropagation(); focusCell(); }
  });
  const beginDrag = (event: Event, panelDrag: boolean) => {
    const e = event as PointerEvent; if (e.button !== 0 || panelDrag && window.innerWidth <= 400) return;
    const target = e.currentTarget as HTMLElement, box = (panelDrag ? panel : launcherGroup).getBoundingClientRect();
    drag = { target, id: e.pointerId, startX: e.clientX, startY: e.clientY, x: box.left, y: box.top, moved: false, panel: panelDrag }; target.setPointerCapture(e.pointerId); suppressClick = false;
  };
  on(launcher, 'pointerdown', e => beginDrag(e, false)); on(el('.title'), 'pointerdown', e => beginDrag(e, true));
  const moveDrag = (event: Event) => {
    const e = event as PointerEvent; if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    if (!drag.moved && !drag.panel) setMenuOpen(false);
    drag.moved = true; const target = drag.panel ? panel : launcherGroup;
    target.style.left = `${Math.max(12, Math.min(window.innerWidth - target.offsetWidth - 12, drag.x + dx))}px`; target.style.top = `${Math.max(12, Math.min(window.innerHeight - target.offsetHeight - 12, drag.y + dy))}px`;
  };
  const endDrag = (event: Event) => {
    const e = event as PointerEvent; if (!drag || e.pointerId !== drag.id) return;
    if (drag.moved) {
      if (drag.panel) { const b = panel.getBoundingClientRect(); settings.position = { x: Math.max(0, Math.min(1, (b.right - 48) / window.innerWidth)), y: Math.max(0, Math.min(1, (b.bottom + 8) / window.innerHeight)) }; }
      else { const b = launcherGroup.getBoundingClientRect(); settings.position = { x: b.left / window.innerWidth, y: b.top / window.innerHeight }; suppressClick = true; position(); }
      scheduleSave();
    }
    if (drag.target.hasPointerCapture(e.pointerId)) drag.target.releasePointerCapture(e.pointerId); drag = null;
  };
  for (const target of [launcher, el('.title')]) { on(target, 'pointermove', moveDrag); on(target, 'pointerup', endDrag); on(target, 'pointercancel', endDrag); }
  on(document, 'visibilitychange', () => { syncClock(); if (document.hidden) persist(); }); on(window, 'pagehide', () => persist()); on(window, 'resize', position);
  if (window.visualViewport) on(window.visualViewport, 'resize', position);
  host.dataset.theme = settings.theme; position();
  return { destroy() { if (destroyed) return; destroyed = true; menuOpen = false; open = false; clock.destroy(); persist(false); for (const dispose of cleanup.reverse()) dispose(); if (drag && drag.target.hasPointerCapture(drag.id)) drag.target.releasePointerCapture(drag.id); drag = null; host.remove(); } };
}
