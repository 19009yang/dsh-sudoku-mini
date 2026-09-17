import { BANK_VERSION, TRANSFORM_VERSION, createGame, puzzles } from '../game/puzzles.ts';
import { isComplete } from '../game/rules.ts';
import { CELLS, SIZE, type Game2048, type Tile } from '../game2048/types.ts';
import { difficulties, type CellChange, type GameState, type HistoryEntry, type Settings } from '../game/types.ts';

export const GAME_KEY = 'dsh-sudoku-mini:v1:game';
export const SETTINGS_KEY = 'dsh-sudoku-mini:v1:settings';
export const G2048_KEY = 'dsh-sudoku-mini:v1:g2048';
export const G2048_BEST_KEY = 'dsh-sudoku-mini:v1:g2048-best';
export const defaultSettings: Settings = { difficulty: 'expert', answerCheck: false, autoClean: true, theme: 'system', position: null };
export interface Snapshot {
  schema: 1; bankVersion: number; transformVersion: number; tabId: string; revision: number;
  puzzleId: string; seed: number; values: number[]; notes: number[]; elapsedMs: number;
  hintCount: number; selectedCell: number | null; noteMode: boolean; history: HistoryEntry[];
}
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
function change(v: unknown): v is CellChange {
  return record(v) && integer(v.index, 0, 80) && integer(v.value, 0, 9) && integer(v.notes, 0, 511) && (!v.value || v.notes === 0);
}
export function restoreSnapshot(raw: unknown): GameState {
  if (!record(raw) || raw.schema !== 1 || raw.bankVersion !== BANK_VERSION || raw.transformVersion !== TRANSFORM_VERSION) throw new Error('存档版本不兼容');
  const puzzle = puzzles.find(p => p.id === raw.puzzleId);
  if (!puzzle || !integer(raw.seed, 0, 0xffffffff)) throw new Error('题目不存在');
  const state = createGame(puzzle, raw.seed);
  if (!Array.isArray(raw.values) || raw.values.length !== 81 || !raw.values.every(v => integer(v, 0, 9))) throw new Error('数字格式无效');
  if (!Array.isArray(raw.notes) || raw.notes.length !== 81 || !raw.notes.every(v => integer(v, 0, 511))) throw new Error('笔记格式无效');
  if (!raw.values.every((v, i) => (!state.givens[i] || v === state.givens[i]) && (!v || raw.notes instanceof Array && raw.notes[i] === 0))) throw new Error('固定格或笔记无效');
  if (!integer(raw.elapsedMs, 0, Number.MAX_SAFE_INTEGER) || !integer(raw.hintCount, 0, Number.MAX_SAFE_INTEGER) || !(raw.selectedCell === null || integer(raw.selectedCell, 0, 80)) || typeof raw.noteMode !== 'boolean') throw new Error('游戏状态无效');
  if (!Array.isArray(raw.history) || raw.history.length > 200) throw new Error('历史格式无效');
  const history: HistoryEntry[] = [];
  for (const h of raw.history) {
    if (!record(h) || !Array.isArray(h.before) || !Array.isArray(h.after) || !h.before.length || h.before.length !== h.after.length || h.before.length > 81 || !h.before.every(change) || !h.after.every(change)) throw new Error('撤销动作无效');
    if (new Set(h.before.map(c => c.index)).size !== h.before.length || !h.before.every((c, i) => c.index === (h.after as CellChange[])[i].index && !state.givens[c.index])) throw new Error('撤销修改固定格');
    history.push({ before: h.before, after: h.after });
  }
  // Validate the chain against the current board, rather than trusting serialized undo.
  const checkValues = [...raw.values], checkNotes = [...raw.notes];
  for (const h of [...history].reverse()) {
    for (const c of h.after) if (checkValues[c.index] !== c.value || checkNotes[c.index] !== c.notes) throw new Error('撤销历史失配');
    for (const c of h.before) { checkValues[c.index] = c.value; checkNotes[c.index] = c.notes; }
  }
  return { ...state, values: raw.values as GameState['values'], notes: raw.notes, elapsedMs: raw.elapsedMs, hintCount: raw.hintCount, selectedCell: raw.selectedCell, noteMode: raw.noteMode, history, status: isComplete(raw.values) ? 'won' : 'playing' };
}
export function readSettings(storage?: Storage): Settings {
  try {
    const raw: unknown = JSON.parse((storage ?? localStorage).getItem(SETTINGS_KEY) ?? 'null');
    if (!record(raw)) return { ...defaultSettings };
    const position = record(raw.position) && typeof raw.position.x === 'number' && typeof raw.position.y === 'number' && Number.isFinite(raw.position.x) && Number.isFinite(raw.position.y) ? { x: Math.max(0, Math.min(1, raw.position.x)), y: Math.max(0, Math.min(1, raw.position.y)) } : null;
    return { difficulty: difficulties.includes(raw.difficulty as Settings['difficulty']) ? raw.difficulty as Settings['difficulty'] : 'expert', answerCheck: raw.answerCheck === true, autoClean: raw.autoClean !== false, theme: raw.theme === 'light' || raw.theme === 'dark' ? raw.theme : 'system', position };
  } catch { return { ...defaultSettings }; }
}
export function readGame(storage?: Storage): { game: GameState | null; error: boolean } {
  try {
    const text = (storage ?? localStorage).getItem(GAME_KEY);
    if (text === null) return { game: null, error: false };
    if (text.length > 65_536) throw new Error('存档过大');
    return { game: restoreSnapshot(JSON.parse(text)), error: false };
  } catch { return { game: null, error: true }; }
}
export function saveGame(game: GameState | null, settings: Settings, tabId: string, revision: number, storage?: Storage): boolean {
  try {
    const target = storage ?? localStorage;
    target.setItem(SETTINGS_KEY, JSON.stringify(settings));
    if (game) {
      const snapshot: Snapshot = { schema: 1, bankVersion: BANK_VERSION, transformVersion: TRANSFORM_VERSION, tabId, revision, puzzleId: game.puzzleId, seed: game.transformSeed, values: game.values, notes: game.notes, elapsedMs: Math.floor(game.elapsedMs), hintCount: game.hintCount, selectedCell: game.selectedCell, noteMode: game.noteMode, history: game.history };
      let text = JSON.stringify(snapshot);
      while (text.length > 65_536 && snapshot.history.length) { snapshot.history = snapshot.history.slice(1); text = JSON.stringify(snapshot); }
      if (text.length > 65_536) return false;
      target.setItem(GAME_KEY, text);
    }
    return true;
  } catch { return false; }
}

/** Persists only the shared preferences (theme, window position, difficulty). */
export function saveSettings(settings: Settings, storage?: Storage): boolean {
  try { (storage ?? localStorage).setItem(SETTINGS_KEY, JSON.stringify(settings)); return true; } catch { return false; }
}

export function readG2048Best(storage?: Storage): number {
  try { const value = Number((storage ?? localStorage).getItem(G2048_BEST_KEY)); return Number.isInteger(value) && value >= 0 ? value : 0; } catch { return 0; }
}

export function readG2048(storage?: Storage): { game: Game2048 | null; error: boolean } {
  try {
    const text = (storage ?? localStorage).getItem(G2048_KEY);
    if (text === null) return { game: null, error: false };
    if (text.length > 65_536) throw new Error('存档过大');
    return { game: restoreG2048(JSON.parse(text)), error: false };
  } catch { return { game: null, error: true }; }
}

export function restoreG2048(raw: unknown): Game2048 {
  if (!record(raw) || raw.schema !== 1) throw new Error('存档版本不兼容');
  if (!Array.isArray(raw.tiles) || raw.tiles.length > CELLS) throw new Error('方块格式无效');
  const cells = new Set<number>(), ids = new Set<number>(), tiles: Tile[] = [];
  for (const tile of raw.tiles) {
    if (!record(tile) || !integer(tile.id, 1, 1_000_000) || !integer(tile.row, 0, SIZE - 1) || !integer(tile.col, 0, SIZE - 1)) throw new Error('方块格式无效');
    if (!integer(tile.value, 2, 1 << 20) || (tile.value & tile.value - 1) !== 0) throw new Error('方块数值无效');
    const cell = tile.row * SIZE + tile.col;
    if (cells.has(cell) || ids.has(tile.id)) throw new Error('方块位置冲突');
    cells.add(cell); ids.add(tile.id);
    tiles.push({ id: tile.id, value: tile.value, row: tile.row, col: tile.col });
  }
  if (!integer(raw.score, 0, Number.MAX_SAFE_INTEGER) || !integer(raw.seed, 0, 0xffffffff)) throw new Error('分数或种子无效');
  if (!integer(raw.nextId, 1, 1_000_000) || !integer(raw.moves, 0, Number.MAX_SAFE_INTEGER)) throw new Error('计分状态无效');
  if (raw.status !== 'playing' && raw.status !== 'over') throw new Error('游戏状态无效');
  if (typeof raw.won !== 'boolean') throw new Error('游戏状态无效');
  // Values above are range-checked, so the assertion only restores their literal union.
  const snapshot = { score: raw.score, seed: raw.seed, nextId: raw.nextId, moves: raw.moves, won: raw.won, status: raw.status as Game2048['status'] };
  if (tiles.some(tile => tile.id >= snapshot.nextId)) throw new Error('方块标识无效');
  return { tiles, ...snapshot };
}

export function saveG2048(game: Game2048 | null, best: number, storage?: Storage): boolean {
  try {
    const target = storage ?? localStorage;
    target.setItem(G2048_BEST_KEY, String(Math.max(0, Math.floor(best))));
    if (game) target.setItem(G2048_KEY, JSON.stringify({ schema: 1, ...game }));
    return true;
  } catch { return false; }
}
